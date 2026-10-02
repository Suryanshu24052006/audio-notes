import re
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from . import config, db, storage


@asynccontextmanager
async def lifespan(app):
    db.init()
    yield
    db.pool.close()


app = FastAPI(title="Audio notes API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def safe_filename(name):
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-.")
    return cleaned[:100] or "audio"


def get_recording_or_404(conn, recording_id):
    row = conn.execute("SELECT * FROM recordings WHERE id = %s", (recording_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "There's no recording with that id.")
    return row


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/recordings", status_code=201)
def create_recording(file: UploadFile = File(...), language: str = Form(...)):
    if language not in config.LANGUAGES:
        raise HTTPException(400, "That language isn't supported.")
    size = file.size or 0
    if size == 0:
        raise HTTPException(400, "This file is empty.")
    if size > config.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"This file is too big. The limit is {config.MAX_UPLOAD_MB} MB.")

    filename = (file.filename or "audio")[:255]
    content_type = file.content_type or "application/octet-stream"
    key = f"recordings/{uuid.uuid4().hex}/{safe_filename(filename)}"

    # bucket first, so a row only exists if the file was actually saved
    try:
        storage.upload(file.file, key, content_type)
    except Exception:
        raise HTTPException(502, "We couldn't save the file to storage. Please try again.")

    with db.pool.connection() as conn:
        row = conn.execute(
            """
            INSERT INTO recordings (filename, content_type, size_bytes, language, storage_key, status)
            VALUES (%s, %s, %s, %s, %s, 'queued')
            RETURNING id
            """,
            (filename, content_type, size, language, key),
        ).fetchone()
    return {"id": row["id"]}


@app.get("/recordings")
def list_recordings():
    with db.pool.connection() as conn:
        return conn.execute(
            """
            SELECT id, filename, language, duration_s, status, chunks_done, chunks_total,
                   error, summary_error, created_at
            FROM recordings
            ORDER BY created_at DESC
            LIMIT 100
            """
        ).fetchall()


@app.get("/recordings/{recording_id}")
def get_recording(recording_id: int):
    with db.pool.connection() as conn:
        rec = get_recording_or_404(conn, recording_id)
        parts = conn.execute(
            """
            SELECT idx, start_s, end_s, text
            FROM chunks
            WHERE recording_id = %s AND status = 'done'
            ORDER BY idx
            """,
            (recording_id,),
        ).fetchall()
    rec.pop("storage_key")
    return {**rec, "parts": parts}


@app.get("/recordings/{recording_id}/audio")
def get_audio(recording_id: int):
    with db.pool.connection() as conn:
        rec = get_recording_or_404(conn, recording_id)
    # redirect instead of streaming it ourselves, so the audio doesn't go through the api
    return RedirectResponse(storage.playback_url(rec["storage_key"]))


@app.post("/recordings/{recording_id}/retry")
def retry(recording_id: int):
    with db.pool.connection() as conn:
        rec = get_recording_or_404(conn, recording_id)
        failed = rec["status"] == "failed" and rec["can_retry"]
        summary_failed = rec["status"] == "completed" and rec["summary_error"]
        if not (failed or summary_failed):
            raise HTTPException(409, "There's nothing to retry for this recording.")

        # finished parts keep their text, so only the failed ones get redone
        conn.execute(
            "UPDATE chunks SET status = 'pending', error = NULL WHERE recording_id = %s AND status = 'failed'",
            (recording_id,),
        )
    db.update_recording(recording_id, status="queued", error=None, summary_error=None)
    return {"status": "queued"}
