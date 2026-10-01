"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { uploadRecording } from "../lib/api";
import { LANGUAGES, formatSize } from "../lib/format";

export default function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState("en-IN");
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

  function chooseFile(event) {
    const chosen = event.target.files?.[0] || null;
    setFile(chosen);
    setSent(0);
    setError(chosen && chosen.size === 0 ? "This file is empty. Choose another one." : "");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) return setError("Choose an audio file first.");
    if (file.size === 0) return setError("This file is empty. Choose another one.");

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

  return (
    <form className="box" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="audio-file">Audio file</label>
        <input
          id="audio-file"
          type="file"
          accept="audio/*,.webm,.opus,.amr"
          onChange={chooseFile}
          disabled={uploading}
        />
        {file && (
          <span className="small muted">
            Selected: {file.name} ({formatSize(file.size)})
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="language">Language spoken</label>
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
        <span className="small muted">For Hindi and English mixed together, pick English.</span>
      </div>

      <div>
        <button className="button" type="submit" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload and transcribe"}
        </button>
      </div>

      {error && <p className="inline-error" role="alert">{error}</p>}

      {uploading && (
        <div className="upload-progress" aria-live="polite">
          <div className="row-between small">
            <span>{percent < 100 ? `Uploading ${file.name}` : "Saving to storage…"}</span>
            <span className="mono muted">
              {percent}% · {formatSize(sent)} of {formatSize(file.size)}
            </span>
          </div>
          <div className="bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}
    </form>
  );
}
