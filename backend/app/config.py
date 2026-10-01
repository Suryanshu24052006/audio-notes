import os

from dotenv import load_dotenv

load_dotenv()


def required(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is not set. Add it to backend/.env (see .env.example).")
    return value


DATABASE_URL = required("DATABASE_URL")

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL") or None
S3_REGION = os.getenv("S3_REGION", "auto")
S3_BUCKET = required("S3_BUCKET")
S3_ACCESS_KEY_ID = required("S3_ACCESS_KEY_ID")
S3_SECRET_ACCESS_KEY = required("S3_SECRET_ACCESS_KEY")
# railway buckets use virtual-hosted urls, local minio/supabase need "path"
S3_ADDRESSING_STYLE = os.getenv("S3_ADDRESSING_STYLE", "virtual")

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "200"))

# only the worker needs these, it checks them on startup
GNANI_API_KEY = os.getenv("GNANI_API_KEY", "")
GNANI_URL = os.getenv("GNANI_URL", "https://api.vachana.ai/stt/v3")

LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-3.8-flash")
LLM_BACKUP_MODEL = os.getenv("LLM_BACKUP_MODEL", "gemini-3.5-flash-lite")

FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

LANGUAGES = {
    "en-IN": "English",
    "hi-IN": "Hindi",
    "bn-IN": "Bengali",
    "gu-IN": "Gujarati",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
    "mr-IN": "Marathi",
    "pa-IN": "Punjabi",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
}
