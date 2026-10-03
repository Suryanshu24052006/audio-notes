"use client";

import { useEffect, useState } from "react";
import RecordingTable from "../components/RecordingTable";
import UploadForm from "../components/UploadForm";
import { api } from "../lib/api";

export default function HomePage() {
  const [recordings, setRecordings] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;

    async function load() {
      try {
        const list = await api("/recordings");
        if (!stopped) {
          setRecordings(list);
          setError("");
        }
      } catch (err) {
        if (!stopped) setError(err.message);
      }
    }

    load();
    const timer = setInterval(load, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      <section className="stack">
        <h1>Upload a recording</h1>
        <p className="muted">
          MP3, WAV, M4A, OGG, FLAC, AAC or WEBM, any length, up to 200 MB. Long recordings are cut
          into short parts and transcribed one by one, so you can watch the progress.
        </p>
      </section>

      <UploadForm />

      <section className="card stack-lg">
        <div className="stack" style={{ gap: 2 }}>
          <h2>Past uploads</h2>
          <p className="small muted">Your uploads are private to this browser. The examples are visible to everyone.</p>
        </div>
        {error && <p className="notice-warn">{error}</p>}
        {recordings === null
          ? !error && <p className="muted">Loading…</p>
          : <RecordingTable recordings={recordings} />}
      </section>
    </>
  );
}
