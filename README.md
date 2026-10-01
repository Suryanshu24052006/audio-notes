# audio notes

Upload an audio recording (any length), get back a transcript from Gnani's speech-to-text API
and a summary from Gemini. Past uploads are saved and can be reopened.


```
frontend/   Next.js - upload page, recording page, /architecture
backend/    FastAPI api (app/main.py) + background worker (app/worker.py)
```

Stack: Next.js on Vercel. FastAPI, the worker, Postgres and a storage bucket for the audio files on Railway.

## Running locally

Needs Python 3.11+, Node 20+, ffmpeg and Docker (for Postgres).

```bash
docker compose up -d                 # postgres

cd backend
python -m venv .venv
.venv\Scripts\activate               # mac/linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # fill in the keys

uvicorn app.main:app --reload        # api on :8000
python -m app.worker                 # worker, in a second terminal
```

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                          # :3000
```

To check the Gnani and Gemini keys without the rest of the app:

```bash
python check_services.py some-recording.m4a en-IN
```

## Env vars

| | |
|---|---|
| `DATABASE_URL` | Postgres |
| `S3_ENDPOINT_URL`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | storage bucket |
| `S3_ADDRESSING_STYLE` | `virtual` (default, railway) or `path` (minio, supabase) |
| `MAX_UPLOAD_MB` | upload size limit, default 200 |
| `GNANI_API_KEY` | Gnani (worker only) |
| `LLM_API_KEY`, `LLM_MODEL` | Gemini (worker only) |
| `FRONTEND_ORIGINS` | frontend url(s) for CORS |
| `NEXT_PUBLIC_API_URL` | frontend → backend url |

## Deploying

- Railway: one service for the api (root dir `backend`, uses the Dockerfile), a second one from the
  same repo for the worker with start command `python -m app.worker`, a Postgres database and a bucket.
- Vercel: root dir `frontend`, set `NEXT_PUBLIC_API_URL` to the Railway api url.
- Add the Vercel url to `FRONTEND_ORIGINS`.

## Tests

```bash
cd backend
pytest
```
