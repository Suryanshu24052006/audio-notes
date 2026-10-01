# background worker, runs separately from the API:  python -m app.worker
import logging
import tempfile
import time
from pathlib import Path

from . import audio, config, db, gnani, storage
from .summarize import SummaryError, summarize

IDLE_SLEEP_S = 2
STALE_AFTER = "10 minutes"

log = logging.getLogger("worker")


class PartFailed(Exception):
    def __init__(self, message, retryable):
        super().__init__(message)
        self.retryable = retryable


def claim_next_job():
    # SKIP LOCKED so two workers never pick the same recording
    with db.pool.connection() as conn:
        return conn.execute(
            """
            UPDATE recordings
            SET status = 'processing', updated_at = now()
            WHERE id = (
                SELECT id FROM recordings
                WHERE status = 'queued'
                ORDER BY created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            RETURNING *
            """
        ).fetchone()


def fail_stale_jobs():
    with db.pool.connection() as conn:
        # no progress for a while = the worker died mid-job
        conn.execute(
            f"""
            UPDATE recordings
            SET status = 'failed',
                error = 'Processing was interrupted. Retry to continue from where it stopped.',
                can_retry = TRUE,
                updated_at = now()
            WHERE status IN ('processing', 'transcribing', 'summarizing')
              AND updated_at < now() - interval '{STALE_AFTER}'
            """
        )
        # tab closed mid-upload
        conn.execute(
            """
            UPDATE recordings
            SET status = 'failed',
                error = 'The upload didn''t finish. Please upload the file again.',
                can_retry = FALSE,
                updated_at = now()
            WHERE status = 'uploading' AND updated_at < now() - interval '1 hour'
            """
        )


def load_parts(recording_id):
    with db.pool.connection() as conn:
        return conn.execute(
            "SELECT idx, start_s, end_s, status, text FROM chunks WHERE recording_id = %s ORDER BY idx",
            (recording_id,),
        ).fetchall()


def save_plan(recording_id, plan):
    with db.pool.connection() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO chunks (recording_id, idx, start_s, end_s) VALUES (%s, %s, %s, %s)",
                [(recording_id, i, start, end) for i, (start, end) in enumerate(plan)],
            )


def mark_part_done(recording_id, idx, text):
    with db.pool.connection() as conn:
        conn.execute(
            "UPDATE chunks SET status = 'done', text = %s, error = NULL WHERE recording_id = %s AND idx = %s",
            (text, recording_id, idx),
        )
        # count instead of +1 so it stays right after retries
        conn.execute(
            """
            UPDATE recordings
            SET chunks_done = (SELECT count(*) FROM chunks WHERE recording_id = %s AND status = 'done'),
                updated_at = now()
            WHERE id = %s
            """,
            (recording_id, recording_id),
        )


def mark_part_failed(recording_id, idx, message):
    with db.pool.connection() as conn:
        conn.execute(
            "UPDATE chunks SET status = 'failed', error = %s WHERE recording_id = %s AND idx = %s",
            (message, recording_id, idx),
        )


def transcribe_parts(rec, wav, workdir, parts):
    rid = rec["id"]
    for part in parts:
        if part["status"] == "done":
            continue

        path = workdir / f"part-{part['idx']:04d}.wav"
        audio.cut(wav, part["start_s"], part["end_s"], path)
        try:
            text = gnani.transcribe(path, rec["language"])
        except gnani.GnaniError as e:
            mark_part_failed(rid, part["idx"], str(e))
            raise PartFailed(
                f"Transcription stopped at part {part['idx'] + 1} of {len(parts)}. {e}", e.retryable
            )
        mark_part_done(rid, part["idx"], text)


def process(rec):
    rid = rec["id"]
    parts = load_parts(rid)

    # if this is a retry and all parts are done, skip straight to the summary
    if not parts or any(p["status"] != "done" for p in parts):
        with tempfile.TemporaryDirectory() as tmp:
            workdir = Path(tmp)
            original = workdir / "original"
            wav = workdir / "clean.wav"

            storage.download(rec["storage_key"], original)
            audio.check_readable(original)
            audio.to_wav(original, wav)
            total_s = audio.duration(wav)

            if not parts:
                save_plan(rid, audio.plan_parts(total_s, audio.find_pauses(wav)))
                parts = load_parts(rid)

            done = sum(1 for p in parts if p["status"] == "done")
            db.update_recording(
                rid, status="transcribing", duration_s=total_s,
                chunks_total=len(parts), chunks_done=done,
            )
            transcribe_parts(rec, wav, workdir, parts)
        parts = load_parts(rid)

    transcript = " ".join(p["text"] for p in parts if p["text"]).strip()
    if not transcript:
        db.update_recording(rid, status="failed", transcript="", can_retry=False,
                            error="No speech was detected in this recording.")
        return

    db.update_recording(rid, status="summarizing", transcript=transcript)
    try:
        db.update_recording(rid, status="completed", summary=summarize(transcript), summary_error=None)
    except SummaryError as e:
        # keep the transcript even if the summary fails
        db.update_recording(rid, status="completed", summary_error=str(e))


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    config.required("GNANI_API_KEY")
    config.required("LLM_API_KEY")
    db.init()
    log.info("worker started")

    while True:
        fail_stale_jobs()
        rec = claim_next_job()
        if rec is None:
            time.sleep(IDLE_SLEEP_S)
            continue

        log.info("recording %s: %s", rec["id"], rec["filename"])
        started = time.monotonic()
        try:
            process(rec)
            log.info("recording %s finished in %.1fs", rec["id"], time.monotonic() - started)
        except audio.BadAudio as e:
            db.update_recording(rec["id"], status="failed", error=str(e), can_retry=False)
        except PartFailed as e:
            db.update_recording(rec["id"], status="failed", error=str(e), can_retry=e.retryable)
        except Exception:
            log.exception("recording %s crashed", rec["id"])
            db.update_recording(rec["id"], status="failed", can_retry=True,
                                error="Something went wrong on our side while processing this file.")


if __name__ == "__main__":
    main()
