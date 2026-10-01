# quick check that gnani + gemini work with the keys in .env
# usage: python check_services.py recording.mp3 en-IN
# only sends the first 3 parts (~75s) to save credits
import os
import sys
import tempfile
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
# db and bucket aren't used here
for name in ("DATABASE_URL", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"):
    if not os.getenv(name):
        os.environ[name] = "not-needed-for-this-check"

from app import audio, config, gnani  # noqa: E402
from app.summarize import SummaryError, summarize  # noqa: E402

MAX_PARTS_TO_SEND = 3


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python check_services.py <audio file> [language code, default en-IN]")
    source = Path(sys.argv[1])
    language = sys.argv[2] if len(sys.argv) > 2 else "en-IN"
    if language not in config.LANGUAGES:
        sys.exit(f"Unknown language {language}. Use one of: {', '.join(config.LANGUAGES)}")
    for name in ("GNANI_API_KEY", "LLM_API_KEY"):
        if not os.getenv(name):
            sys.exit(f"{name} is missing. Add it to backend/.env")

    print(f"Gnani endpoint: {config.GNANI_URL}")
    print(f"LLM: {config.LLM_MODEL} (backup {config.LLM_BACKUP_MODEL}) at {config.LLM_BASE_URL}\n")

    texts = []
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "clean.wav"
        audio.check_readable(source)
        audio.to_wav(source, wav)
        total_s = audio.duration(wav)
        parts = audio.plan_parts(total_s, audio.find_pauses(wav))
        print(f"{source.name}: {total_s:.1f} s, cut into {len(parts)} parts "
              f"({', '.join(f'{end - start:.1f}' for start, end in parts)} s)")

        for i, (start, end) in enumerate(parts[:MAX_PARTS_TO_SEND]):
            part = Path(tmp) / f"part-{i}.wav"
            audio.cut(wav, start, end, part)
            began = time.monotonic()
            try:
                text = gnani.transcribe(part, language)
            except gnani.GnaniError as e:
                sys.exit(f"\nGnani FAILED on part {i + 1}: {e}")
            print(f"\nGnani, part {i + 1} ({start:.1f}-{end:.1f} s), {time.monotonic() - began:.1f} s:")
            print(f"  {text or '(no speech)'}")
            texts.append(text)

    transcript = " ".join(t for t in texts if t).strip()
    if not transcript:
        sys.exit("\nGnani answered, but found no speech in these parts. Try a recording with talking in it.")

    began = time.monotonic()
    try:
        summary = summarize(transcript)
    except SummaryError as e:
        sys.exit(f"\nLLM FAILED: {e}")
    print(f"\nLLM summary, {time.monotonic() - began:.1f} s:\n{summary}")
    print("\nBoth services work with your keys.")


if __name__ == "__main__":
    main()
