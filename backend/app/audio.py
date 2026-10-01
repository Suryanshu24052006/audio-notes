import json
import re
import subprocess

# gnani REST allows max 60s per request (30s recommended)
MAX_PART_S = 28.0
MIN_PART_S = 10.0
# a pause = quieter than -35 dB for at least 0.4s
SILENCE_DB = -35
SILENCE_MIN_S = 0.4


class BadAudio(Exception):
    pass


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def check_readable(path):
    result = run([
        "ffprobe", "-v", "error",
        "-select_streams", "a",
        "-show_entries", "stream=codec_type",
        "-of", "json", str(path),
    ])
    if result.returncode != 0:
        raise BadAudio(
            "We couldn't read this file as audio. It may be damaged, or not an audio file. "
            "Try exporting it again as MP3 or WAV."
        )
    if not json.loads(result.stdout or "{}").get("streams"):
        raise BadAudio("This file doesn't contain any audio.")


def to_wav(src, dst):
    # 16 kHz mono, same as what gnani uses
    result = run([
        "ffmpeg", "-y", "-v", "error", "-i", str(src),
        "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(dst),
    ])
    if result.returncode != 0:
        raise BadAudio("We couldn't decode this audio file. It may be damaged.")


def duration(path):
    result = run([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ])
    try:
        seconds = float(result.stdout.strip())
    except ValueError:
        raise BadAudio("We couldn't work out how long this recording is.")
    if seconds < 0.1:
        raise BadAudio("This recording is empty.")
    return seconds


def find_pauses(wav):
    result = run([
        "ffmpeg", "-v", "info", "-i", str(wav),
        "-af", f"silencedetect=noise={SILENCE_DB}dB:d={SILENCE_MIN_S}",
        "-f", "null", "-",
    ])
    # silencedetect prints "silence_start: 12.3" / "silence_end: 13.1" to stderr
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", result.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: (-?[\d.]+)", result.stderr)]
    return [(start + end) / 2 for start, end in zip(starts, ends)]


def plan_parts(total_s, pauses):
    # cut at the last pause before the limit, or at the limit if there's no pause
    parts = []
    start = 0.0
    while total_s - start > MAX_PART_S:
        candidates = [p for p in pauses if start + MIN_PART_S <= p <= start + MAX_PART_S]
        end = candidates[-1] if candidates else start + MAX_PART_S
        parts.append((start, end))
        start = end

    # tiny leftover -> merge into the last part
    if parts and total_s - start < 0.5:
        previous_start, _ = parts.pop()
        parts.append((previous_start, total_s))
    else:
        parts.append((start, total_s))
    return parts


def cut(wav, start_s, end_s, dst):
    result = run([
        "ffmpeg", "-y", "-v", "error",
        "-ss", f"{start_s:.3f}", "-i", str(wav),
        "-t", f"{end_s - start_s:.3f}",
        "-c:a", "pcm_s16le", str(dst),
    ])
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg couldn't cut {start_s:.1f}-{end_s:.1f}s: {result.stderr[:200]}")
