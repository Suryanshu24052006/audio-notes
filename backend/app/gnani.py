import time
from pathlib import Path

import requests

from . import config

RETRY_STATUSES = {429, 500, 502, 503, 504}
WAITS_S = [1, 2, 4]


class GnaniError(Exception):
    def __init__(self, message, retryable):
        super().__init__(message)
        self.retryable = retryable


def transcribe(wav_path, language):
    problem = "no response"
    for attempt in range(len(WAITS_S) + 1):
        if attempt > 0:
            time.sleep(WAITS_S[attempt - 1])

        try:
            with open(wav_path, "rb") as f:
                response = requests.post(
                    config.GNANI_URL,
                    headers={"X-API-Key-ID": config.GNANI_API_KEY},
                    files={"audio_file": (Path(wav_path).name, f, "audio/wav")},
                    data={"language_code": language, "format": "transcribe"},
                    timeout=60,
                )
        except requests.Timeout:
            problem = "timed out"
            continue
        except requests.ConnectionError:
            problem = "couldn't connect"
            continue
        except requests.RequestException:
            # same as in summarize.py - the exception text can contain the key
            raise GnaniError(
                "Couldn't send the request to the transcription service. Check GNANI_API_KEY.",
                retryable=True,
            )

        if response.status_code in RETRY_STATUSES:
            problem = f"HTTP {response.status_code}"
            continue

        try:
            body = response.json()
        except ValueError:
            body = {}

        if response.ok and body.get("success"):
            return (body.get("transcript") or "").strip()

        if response.status_code in (401, 403):
            raise GnaniError(
                "The transcription service refused the request. "
                "The API key may be wrong, or the account may be out of credits.",
                retryable=True,
            )

        # 400 etc. - the audio itself is the problem, retrying won't help
        message = (body.get("error") or {}).get("message") or response.text[:200]
        raise GnaniError(f"The transcription service rejected this audio: {message}", retryable=False)

    raise GnaniError(
        f"The transcription service didn't respond after {len(WAITS_S) + 1} tries ({problem}).",
        retryable=True,
    )
