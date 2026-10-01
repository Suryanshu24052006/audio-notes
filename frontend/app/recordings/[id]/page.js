"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import StatusSteps from "../../../components/StatusSteps";
import Summary from "../../../components/Summary";
import Transcript from "../../../components/Transcript";
import { api } from "../../../lib/api";
import { FINISHED, formatDuration, formatSize, languageName, timeAgo } from "../../../lib/format";

const POLL_MS = 2000;

export default function RecordingPage() {
  const { id } = useParams();
  const [rec, setRec] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [lastChecked, setLastChecked] = useState(null);
  const [pollRound, setPollRound] = useState(0); // restarts polling after a retry
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  useEffect(() => {
    let stopped = false;
    let timer;

    async function poll() {
      try {
        const data = await api(`/recordings/${id}`);
        if (stopped) return;
        setRec(data);
        setConnectionError("");
        setLastChecked(Date.now());
        if (FINISHED.includes(data.status)) return;
      } catch (err) {
        if (stopped) return;
        if (err.status === 404) {
          setNotFound(true);
          return;
        }
        setConnectionError(err.message);
      }
      // setTimeout instead of setInterval so slow responses don't pile up
      timer = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id, pollRound]);

  async function retry() {
    setRetrying(true);
    setRetryError("");
    try {
      await api(`/recordings/${id}/retry`, { method: "POST" });
      setPollRound((n) => n + 1);
    } catch (err) {
      setRetryError(err.message);
    }
    setRetrying(false);
  }

  if (notFound) {
    return (
      <div className="stack">
        <Link href="/">← All uploads</Link>
        <h1>Recording not found</h1>
        <p className="muted">The link may be wrong, or the recording was removed.</p>
      </div>
    );
  }

  if (!rec) {
    return (
      <div className="stack">
        <Link href="/">← All uploads</Link>
        <p className={connectionError ? "notice-warn" : "muted"}>{connectionError || "Loading…"}</p>
      </div>
    );
  }

  const details = [
    languageName(rec.language),
    rec.duration_s ? formatDuration(rec.duration_s) : null,
    formatSize(rec.size_bytes),
    `uploaded ${timeAgo(rec.created_at)}`,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <div className="stack">
        <Link href="/">← All uploads</Link>
        <h1>{rec.filename}</h1>
        <p className="muted small">{details}</p>
      </div>

      {connectionError && (
        <p className="notice-warn">{connectionError} Trying again every 2 seconds.</p>
      )}

      {rec.status === "failed" && (
        <FailureNotice rec={rec} onRetry={retry} retrying={retrying} retryError={retryError} />
      )}

      {!FINISHED.includes(rec.status) && <StatusSteps rec={rec} lastChecked={lastChecked} />}

      {rec.status === "completed" && (
        <Summary rec={rec} onRetry={retry} retrying={retrying} retryError={retryError} />
      )}

      <Transcript rec={rec} />
    </>
  );
}

function FailureNotice({ rec, onRetry, retrying, retryError }) {
  const someSaved = rec.chunks_done > 0 && rec.chunks_done < rec.chunks_total;

  return (
    <section className="notice notice-error" role="alert">
      <h2>{rec.can_retry ? "Processing stopped" : "This recording couldn't be processed"}</h2>
      <p>{rec.error}</p>

      {someSaved && (
        <>
          <p>
            {rec.chunks_done} of {rec.chunks_total} parts are saved and shown below. Retrying only
            sends the missing parts.
          </p>
          <div className="bar failed">
            <div style={{ width: `${(rec.chunks_done / rec.chunks_total) * 100}%` }} />
          </div>
        </>
      )}

      <div className="actions">
        {rec.can_retry ? (
          <button className="button" onClick={onRetry} disabled={retrying}>
            {retrying ? "Retrying…" : "Retry"}
          </button>
        ) : (
          <Link className="button" href="/">Upload a different file</Link>
        )}
      </div>
      {retryError && <p className="inline-error">{retryError}</p>}
    </section>
  );
}
