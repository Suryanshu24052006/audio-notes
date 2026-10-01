"use client";

import { useEffect, useState } from "react";

const CURRENT_STEP = { uploading: 0, queued: 1, processing: 1, transcribing: 3, summarizing: 4 };

export default function StatusSteps({ rec, lastChecked }) {
  const secondsAgo = useSecondsSince(lastChecked);
  const current = CURRENT_STEP[rec.status] ?? 0;
  const percent = rec.chunks_total ? Math.round((rec.chunks_done / rec.chunks_total) * 100) : 0;

  const steps = [
    "Upload the file",
    rec.status === "queued" ? "Waiting for the worker to pick it up" : "Check the file and convert it to 16 kHz mono",
    rec.chunks_total ? `Cut into ${rec.chunks_total} parts at pauses` : "Cut it into parts at pauses",
    "Transcribe each part",
    "Write the summary",
  ];

  return (
    <section className="box">
      <h2 style={{ fontSize: 18 }}>Status</h2>
      <ol className="steps">
        {steps.map((label, i) => {
          const state = i < current ? "done" : i === current ? "now" : "next";
          return (
            <li key={i}>
              <span className={`step-state state-${state}`}>{state}</span>
              <div className="step-body">
                <span style={state === "now" ? { fontWeight: 600 } : state === "next" ? { color: "var(--muted)" } : undefined}>
                  {label}
                </span>
                {i === 3 && state === "now" && (
                  <>
                    <div className="bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                      <div style={{ width: `${percent}%` }} />
                    </div>
                    <span className="small muted">
                      {rec.chunks_done} of {rec.chunks_total} parts done · {percent}%
                    </span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="status-note">
        {secondsAgo === null ? "Checking…" : `Last checked ${secondsAgo} s ago.`} You can close this
        tab: the work carries on on the server, and this recording will be in your past uploads
        when you come back.
      </p>
    </section>
  );
}

function useSecondsSince(time) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return time ? Math.max(0, Math.round((now - time) / 1000)) : null;
}
