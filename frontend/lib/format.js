export const LANGUAGES = [
  { code: "en-IN", label: "English (India)", short: "English" },
  { code: "hi-IN", label: "हिन्दी · Hindi", short: "Hindi" },
  { code: "bn-IN", label: "বাংলা · Bengali", short: "Bengali" },
  { code: "gu-IN", label: "ગુજરાતી · Gujarati", short: "Gujarati" },
  { code: "kn-IN", label: "ಕನ್ನಡ · Kannada", short: "Kannada" },
  { code: "ml-IN", label: "മലയാളം · Malayalam", short: "Malayalam" },
  { code: "mr-IN", label: "मराठी · Marathi", short: "Marathi" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ · Punjabi", short: "Punjabi" },
  { code: "ta-IN", label: "தமிழ் · Tamil", short: "Tamil" },
  { code: "te-IN", label: "తెలుగు · Telugu", short: "Telugu" },
];

export function languageName(code) {
  return LANGUAGES.find((l) => l.code === code)?.short || code;
}

// 48:12 or 1:02:05
export function formatDuration(seconds) {
  if (seconds == null) return "–";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function formatTimestamp(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

export function timeAgo(iso) {
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return date.toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export const FINISHED = ["completed", "failed"];

// tone picks the colour, group is used by the filter buttons on the home page
export function statusSummary(rec) {
  switch (rec.status) {
    case "queued":
      return { text: "Waiting to start", tone: "progress", group: "progress" };
    case "processing":
      return { text: "Preparing audio", tone: "progress", group: "progress" };
    case "transcribing":
      return { text: `Transcribing ${rec.chunks_done}/${rec.chunks_total}`, tone: "progress", group: "progress" };
    case "summarizing":
      return { text: "Writing summary", tone: "progress", group: "progress" };
    case "completed":
      return rec.summary_error
        ? { text: "Done, no summary", tone: "failed", group: "done" }
        : { text: "Done", tone: "done", group: "done" };
    default:
      return { text: "Failed", tone: "failed", group: "failed" };
  }
}
