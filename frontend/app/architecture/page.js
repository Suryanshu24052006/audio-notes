import { LLM_NAME, REPO_URL, STORAGE_NAME } from "../../lib/site";

export const metadata = { title: "How this works · audio notes" };

const FLOW = `browser  1. upload the audio file ──▶ FastAPI ──▶ storage bucket
                                      FastAPI ──▶ Postgres  (new row: queued)
worker   2. take the next queued job ─▶ Postgres
worker   3. download the audio ─────▶ storage bucket
worker   4. each part, 28 s or less ─▶ Gnani ASR
worker   5. the full transcript ────▶ ${LLM_NAME}  (summary)
browser  6. every 2 s: "how far?" ──▶ FastAPI ──▶ Postgres`;

export default function ArchitecturePage() {
  return (
    <>
      <section className="stack">
        <h1>How this works</h1>
        <p className="muted">
          What happens after you upload a file, where everything is stored, and the choices I
          made along the way.
        </p>
        <p>
          Source code: <a href={REPO_URL}>{REPO_URL.replace("https://", "")}</a>
        </p>
      </section>

      <section className="prose">
        <h2>From upload to transcript</h2>
        <pre className="flow">{FLOW}</pre>
        <ol>
          <li>
            You choose a file and a language. The browser sends it to the API, and the upload
            progress bar shows how much has been sent.
          </li>
          <li>
            The API saves the file in the storage bucket, and only then adds a row to the{" "}
            <code>recordings</code> table with the status <code>queued</code>. If saving fails, no
            row is created and the page shows the error.
          </li>
          <li>
            The worker picks up the job, checks the file with ffprobe, converts it to 16 kHz mono
            with ffmpeg, and cuts it into parts.
          </li>
          <li>Each part goes to Gnani&apos;s speech-to-text API, and its text is saved as soon as it comes back.</li>
          <li>When every part is done, the texts are joined in order and sent to {LLM_NAME} for the summary.</li>
          <li>Meanwhile the recording page asks the API for the status every 2 seconds and shows it.</li>
        </ol>
      </section>

      <section className="prose">
        <h2>Where files live</h2>
        <p>
          Audio files are in a storage bucket ({STORAGE_NAME}), under <code>recordings/&lt;random id&gt;/</code>.
          They are never kept on the server&apos;s own disk, because that disk is wiped on every
          deploy, and the API and the worker run on separate machines that can&apos;t share it. The
          worker downloads a file into a temporary folder while it works on it and deletes the
          folder when it&apos;s done. The player on the recording page asks the API for the audio,
          and the API redirects it to a temporary signed link to the file in the bucket, so the
          audio doesn&apos;t stream through the API.
        </p>
        <p>
          Uploads go through the API instead of straight from the browser to the bucket. My first
          version used presigned URLs so the browser could upload directly, but the storage
          options I looked at either don&apos;t allow browser uploads (CORS) or cap free files at 50 MB.
          Going through the API avoids that, at the cost of the API handling the file. Files are
          limited to 200 MB.
        </p>
        <p>
          Everything else is in Postgres, in two tables: <code>recordings</code> (one row per
          upload: status, progress, transcript, summary, errors) and <code>chunks</code> (one row
          per part, with its start and end time and its text).
        </p>
      </section>

      <section className="prose">
        <h2>How long audio is handled</h2>
        <p>
          Gnani&apos;s speech-to-text REST endpoint accepts at most 60 seconds of audio per request
          and recommends 30. So the worker uses ffmpeg&apos;s <code>silencedetect</code> filter to
          find the pauses, and cuts the recording into parts of 28 seconds or less, always at the
          last pause before the limit so no word is split in half. If someone talks for 28 seconds
          without a pause, it cuts there anyway.
        </p>
        <p>
          The parts are sent to Gnani one after another, and each part&apos;s text is saved the
          moment it arrives. That&apos;s what makes the &quot;12 of 40 parts done&quot; progress
          possible. It also means a retry only sends the parts that are missing, so no credits
          are spent twice.
        </p>
        <p>
          I also looked at Gnani&apos;s Batch API, which takes files up to 4 hours long. I went with
          parts because they give exact progress, a failure costs one part instead of the whole
          file, and the REST endpoint supports all 10 languages. Batch would add speaker labels,
          which I&apos;d like to add later.
        </p>
      </section>

      <section className="prose">
        <h2>What runs right away, and what runs in the background</h2>
        <div className="table-scroll">
          <table style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ width: "50%" }}>Right away, inside the web request</th>
                <th>In the background, in the worker</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Receiving the upload and saving it to the bucket</td><td>Checking and converting the audio</td></tr>
              <tr><td>Creating the recording row</td><td>Cutting it into parts</td></tr>
              <tr><td>Returning a recording&apos;s status and results</td><td>Transcribing every part with Gnani</td></tr>
              <tr><td>Listing past uploads</td><td>Writing the summary</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          The worker is a separate process. It takes queued jobs from Postgres with{" "}
          <code>SELECT … FOR UPDATE SKIP LOCKED</code>, so two workers never take the same file,
          and restarting the web server never loses a job. I used Postgres as the queue instead of
          Redis and Celery because it&apos;s one less service to run, and the job&apos;s status
          already lives in that table.
        </p>
      </section>

      <section className="prose">
        <h2>When something fails</h2>
        <ul>
          <li>Upload interrupted, file too big, or the bucket unreachable: the upload form shows the error and nothing is saved, so you can just upload again.</li>
          <li>Unreadable or damaged file: caught by ffprobe before any transcription credits are spent.</li>
          <li>Gnani busy or down (429, 500, 502, 503, 504, or a timeout): the part is retried after 1, 2 and 4 seconds. If it still fails, the job stops, keeps the finished parts, and offers a retry.</li>
          <li>Audio Gnani rejects (400): not retried, since it would fail the same way again. The message is shown.</li>
          <li>Wrong API key or no credits (401, 403): shown clearly, with a retry for after it&apos;s fixed.</li>
          <li>Summary fails: the transcript is kept and shown, with a separate button to retry just the summary.</li>
          <li>
            The LLM is overloaded (HTTP 503, &quot;high demand&quot;). I hit this while testing, so the
            summary is retried after 5 and 15 seconds, and if the main model is still busy, a lighter
            backup model is used instead.
          </li>
          <li>Worker crashes mid-job: a job with no progress for 10 minutes is marked as interrupted, with a retry.</li>
          <li>Silent recording: shown as &quot;No speech was detected&quot; instead of an empty page.</li>
        </ul>
      </section>

      <section className="prose">
        <h2>What I&apos;d do differently with more time</h2>
        <ul>
          <li>Send three or four parts to Gnani at the same time instead of one after another, so long files finish faster.</li>
          <li>Push status updates to the page with server-sent events instead of asking every 2 seconds.</li>
          <li>Add speaker labels using Gnani&apos;s Batch API with diarization.</li>
          <li>Upload straight from the browser to the bucket with presigned URLs (on storage that allows CORS), and make big uploads resumable.</li>
          <li>Summarise very long transcripts (several hours) in pieces, then combine the pieces.</li>
          <li>Accounts, so each person only sees their own uploads.</li>
          <li>Delete audio from the bucket automatically after 30 days.</li>
        </ul>
      </section>
    </>
  );
}
