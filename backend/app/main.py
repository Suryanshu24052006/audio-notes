import re
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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


class NewRecording(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(default="", max_length=100)
    size_bytes: int = Field(gt=0)
    language: str


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
def create_recording(body: NewRecording):
    if body.language not in config.LANGUAGES:
        raise HTTPException(400, "That language isn't supported.")

    content_type = body.content_type or "application/octet-stream"
    key = f"recordings/{uuid.uuid4().hex}/{safe_filename(body.filename)}"

    with db.pool.connection() as conn:
        row = conn.execute(
            """
            INSERT INTO recordings (filename, content_type, size_bytes, language, storage_key)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (body.filename, content_type, body.size_bytes, body.language, key),
        ).fetchone()

    # the browser uploads straight to the bucket with this link
    return {"id": row["id"], "upload_url": storage.upload_url(key, content_type)}


@app.post("/recordings/{recording_id}/uploaded")
def mark_uploaded(recording_id: int):
    with db.pool.connection() as conn:
        rec = get_recording_or_404(conn, recording_id)
    if rec["status"] != "uploading":
        raise HTTPException(409, "This recording isn't waiting for an upload.")
    if not storage.exists(rec["storage_key"]):
        raise HTTPException(400, "The file never reached storage. Please upload it again.")

    db.update_recording(recording_id, status="queued")
    return {"status": "queued"}


@app.post("/recordings/{recording_id}/upload-failed")
def mark_upload_failed(recording_id: int):
    with db.pool.connection() as conn:
        rec = get_recording_or_404(conn, recording_id)
    if rec["status"] == "uploading":
        db.update_recording(
            recording_id,
            status="failed",
            error="The upload didn't finish. Please upload the file again.",
            can_retry=False,
        )
    return {"status": "failed"}


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
