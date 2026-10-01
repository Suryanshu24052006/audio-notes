import time

import requests

from . import config

INSTRUCTIONS = """You summarise transcripts of audio recordings.
Write in English, even if the transcript is in another language.
Start with two or three sentences on what the recording is about.
Then list the key points, one per line, each line starting with "- ".
Use only what is in the transcript. Don't add facts."""

RETRY_STATUSES = {429, 500, 502, 503, 504}
# gemini kept giving 503 "high demand" when I tested, short waits weren't enough
WAITS_S = [5, 15]


class SummaryError(Exception):
    pass


class TryAgain(Exception):
    pass


def summarize(transcript):
    # try the main model, then the lighter backup one if it's still overloaded
    problem = "no response"
    for model in [config.LLM_MODEL, config.LLM_BACKUP_MODEL]:
        for attempt in range(len(WAITS_S) + 1):
            if attempt > 0:
                time.sleep(WAITS_S[attempt - 1])
            try:
                return ask_gemini(transcript, model)
            except TryAgain as e:
                problem = f"{model}: {e}"
    raise SummaryError(f"The summary service didn't respond after several tries ({problem}).")


def ask_gemini(transcript, model):
    # using gemini's openai-compatible endpoint
    try:
        response = requests.post(
            config.LLM_BASE_URL.rstrip("/") + "/chat/completions",
            headers={"Authorization": f"Bearer {config.LLM_API_KEY}"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": INSTRUCTIONS},
                    {"role": "user", "content": transcript},
                ],
                "temperature": 0.3,
            },
            timeout=120,
        )
    except requests.Timeout:
        raise TryAgain("timed out")
    except requests.ConnectionError:
        raise TryAgain("couldn't connect")
    except requests.RequestException:
        # e.g. a bad character in the key. don't put the exception text in the message,
        # it can contain the key and this message ends up on the website
        raise SummaryError("Couldn't send the request to the summary service. Check LLM_API_KEY.")

    if response.status_code in RETRY_STATUSES:
        raise TryAgain(f"HTTP {response.status_code}: {error_message(response)}")
    if response.status_code in (401, 403):
        raise SummaryError("The summary service refused the API key. Check LLM_API_KEY.")
    if not response.ok:
        raise SummaryError(
            f"The summary service returned an error (HTTP {response.status_code}): {error_message(response)}"
        )

    try:
        return response.json()["choices"][0]["message"]["content"].strip()
    except (ValueError, KeyError, IndexError, TypeError, AttributeError):
        raise SummaryError("The summary service sent back something we couldn't read.")


def error_message(response):
    try:
        body = response.json()
    except ValueError:
        return response.text[:200]
    if isinstance(body, list) and body:  # gemini sometimes wraps the error in a list
        body = body[0]
    error = body.get("error") if isinstance(body, dict) else None
    if isinstance(error, dict):
        error = error.get("message") or error
    return str(error or body)[:200]
