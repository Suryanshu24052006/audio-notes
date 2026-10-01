"use client";

import { useState } from "react";
import { formatTimestamp } from "../lib/format";

export default function Transcript({ rec }) {
  const [copyMessage, setCopyMessage] = useState("");
  const parts = rec.parts || [];
  if (parts.length === 0) return null;

  const finished = rec.status === "completed";
  const withTimes = parts.map((p) => `[${formatTimestamp(p.start_s)}] ${p.text}`).join("\n\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(rec.transcript);
      setCopyMessage("Copied");
    } catch {
      setCopyMessage("Couldn't copy. Select the text and copy it instead.");
    }
    setTimeout(() => setCopyMessage(""), 3000);
  }

  function download() {
    const blob = new Blob([withTimes], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = rec.filename.replace(/\.[^.]+$/, "") + "-transcript.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="stack-lg">
      <div className="stack" style={{ gap: 2 }}>
        <h2>{finished ? "Transcript" : "Transcript so far"}</h2>
        <p className="small muted">
          {finished
            ? "Each time shows where that part starts in the recording."
            : `Parts appear here as they finish: ${parts.length} of ${rec.chunks_total} so far.`}
        </p>
      </div>

      {finished && (
        <div className="actions">
          <button className="button button-plain" onClick={copy}>Copy transcript</button>
          <button className="button button-plain" onClick={download}>Download as .txt</button>
          {copyMessage && <span className="small muted" style={{ alignSelf: "center" }}>{copyMessage}</span>}
        </div>
      )}

      <div className="parts">
        {parts.map((p) => (
          <div className="part" key={p.idx}>
            <time>{formatTimestamp(p.start_s)}</time>
            {p.text
              ? <p lang={rec.language.slice(0, 2)}>{p.text}</p>
              : <p className="muted">(no speech in this part)</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
