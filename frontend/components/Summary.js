"use client";

import { useState } from "react";

export default function Summary({ rec, onRetry, retrying, retryError }) {
  const [copied, setCopied] = useState("");

  if (rec.summary_error) {
    return (
      <section className="notice notice-error" role="alert">
        <h2>The summary couldn't be written</h2>
        <p>{rec.summary_error} The transcript below is complete.</p>
        {!rec.example && (
          <div className="actions">
            <button className="button" onClick={onRetry} disabled={retrying}>
              {retrying ? "Retrying…" : "Retry summary"}
            </button>
          </div>
        )}
        {retryError && <p className="inline-error">{retryError}</p>}
      </section>
    );
  }

  if (!rec.summary) return null;

  // prompt asks for a few sentences then "- " bullet points
  const lines = rec.summary
    .replace(/\*\*/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const isPoint = (line) => /^[-*•]\s/.test(line);
  const sentences = lines.filter((line) => !isPoint(line));
  const points = lines.filter(isPoint).map((line) => line.replace(/^[-*•]\s+/, ""));

  async function copy() {
    try {
      await navigator.clipboard.writeText(rec.summary);
      setCopied("Copied");
    } catch {
      setCopied("Couldn't copy");
    }
    setTimeout(() => setCopied(""), 2500);
  }

  return (
    <section className="summary">
      <div className="section-head">
        <h2>Summary</h2>
        <button type="button" className="button-small" onClick={copy}>
          {copied || "Copy summary"}
        </button>
      </div>
      {sentences.map((text, i) => <p key={i}>{text}</p>)}
      {points.length > 0 && (
        <ul>
          {points.map((text, i) => <li key={i}>{text}</li>)}
        </ul>
      )}
    </section>
  );
}
