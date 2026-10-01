"use client";

export default function Summary({ rec, onRetry, retrying, retryError }) {
  if (rec.summary_error) {
    return (
      <section className="notice notice-error" role="alert">
        <h2>The summary couldn't be written</h2>
        <p>{rec.summary_error} The transcript below is complete.</p>
        <div className="actions">
          <button className="button" onClick={onRetry} disabled={retrying}>
            {retrying ? "Retrying…" : "Retry summary"}
          </button>
        </div>
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

  return (
    <section className="summary">
      <h2>Summary</h2>
      {sentences.map((text, i) => <p key={i}>{text}</p>)}
      {points.length > 0 && (
        <ul>
          {points.map((text, i) => <li key={i}>{text}</li>)}
        </ul>
      )}
    </section>
  );
}
