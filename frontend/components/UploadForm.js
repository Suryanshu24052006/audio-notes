"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { uploadRecording } from "../lib/api";
import { LANGUAGES, formatSize } from "../lib/format";
import Waveform from "./Waveform";

// same limit as MAX_UPLOAD_MB on the backend, checked here too so a big file fails straight away
const MAX_MB = 200;

function fileProblem(file) {
  // the accept list on the input doesn't apply to dropped files, so check the type here.
  // video is allowed because phones often save voice notes as .mp4 / .webm
  const type = file.type || "";
  if (type && !type.startsWith("audio/") && !type.startsWith("video/")) {
    return `${file.name} isn't an audio file. Choose an MP3, WAV, M4A or similar.`;
  }
  if (file.size === 0) return "This file is empty. Choose another one.";
  if (file.size > MAX_MB * 1024 * 1024) return `This file is ${formatSize(file.size)}. The limit is ${MAX_MB} MB.`;
  return "";
}

export default function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState("en-IN");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sent, setSent] = useState(0);
  const [error, setError] = useState("");

  // warn before closing the tab mid-upload
  useEffect(() => {
    if (!uploading) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  function pick(chosen) {
    setFile(chosen);
    setSent(0);
    setError(chosen ? fileProblem(chosen) : "");
  }

  // drag and drop: preventDefault stops the browser from just opening the file
  function onDragOver(event) {
    event.preventDefault();
    if (!uploading) setDragging(true);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (uploading) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) pick(dropped);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) return setError("Choose an audio file first.");
    const problem = fileProblem(file);
    if (problem) return setError(problem);

    setUploading(true);
    setError("");
    setSent(0);

    try {
      // progress is measured on the whole request, which is a bit bigger than the file
      const created = await uploadRecording(file, language, (loaded, total) => setSent((loaded / total) * file.size));
      router.push(`/recordings/${created.id}`);
    } catch (err) {
      setError(err.message);
      setUploading(false);
    }
  }

  const percent = file ? Math.round((sent / file.size) * 100) : 0;
  const waveState = dragging ? "dragging" : uploading ? "uploading" : file && !error ? "ready" : "idle";

  return (
    <form className="upload card" onSubmit={handleSubmit}>
      <label
        className={`drop drop-${waveState}`}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          id="audio-file"
          className="visually-hidden"
          type="file"
          accept="audio/*,.webm,.opus,.amr"
          onChange={(event) => pick(event.target.files?.[0] || null)}
          disabled={uploading}
        />

        <Waveform state={waveState} filled={uploading ? percent / 100 : 0} />

        <div className="drop-text">
          {dragging ? (
            <strong>Drop it here</strong>
          ) : file ? (
            <>
              <strong className="drop-name">{file.name}</strong>
              <span className="muted">{formatSize(file.size)}</span>
              {!uploading && <span className="link-like">Choose a different file</span>}
            </>
          ) : (
            <>
              <strong>Drop an audio file here</strong>
              <span className="muted">
                or <span className="link-like">choose one from your computer</span>
              </span>
            </>
          )}
        </div>
      </label>

      <div className="field">
        <label htmlFor="language">Language spoken</label>
        <div className="upload-row">
          <select
            id="language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            disabled={uploading}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <button className="button" type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload and transcribe"}
          </button>
        </div>
        <span className="small muted">For Hindi and English mixed together, pick English.</span>
      </div>

      {error && <p className="inline-error" role="alert">{error}</p>}

      {uploading && (
        <p className="upload-status small" aria-live="polite">
          <span>{percent < 100 ? "Uploading…" : "Saving to storage…"}</span>
          <span className="muted nums">
            {formatSize(sent)} of {formatSize(file.size)} ({percent}%)
          </span>
        </p>
      )}
    </form>
  );
}
