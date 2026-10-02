import { LLM_NAME, REPO_URL } from "../../lib/site";

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
          What happens after you upload a file, where things are stored, and why I built it this way.
        </p>
        <p>
          GitHub repo: <a href={REPO_URL}>{REPO_URL.replace("https://", "")}</a>
        </p>
        <p>
          Built with Next.js for the website (on Vercel), and FastAPI, a background worker, Postgres
          and a storage bucket for the backend (all on Railway). Transcription is Gnani&apos;s ASR,
          and the summaries come from Google&apos;s {LLM_NAME}.
        </p>
      </section>

      <section className="prose">
        <h2>From upload to transcript</h2>
        <p>
          The short version: you upload a file, the API saves it and adds a job to the database, and
          a separate worker does the slow part. It cuts the audio into short parts, sends each one to
          Gnani, and once they&apos;re all back it asks {LLM_NAME} for a summary.
        </p>
        <pre className="flow">{FLOW}</pre>
        <ol>
          <li>
            You pick a file and the language. The browser sends it to my API, and the bar in the
            upload box shows how much has gone.
          </li>
          <li>
            The API saves the file in the storage bucket first, and only then adds a row to the{" "}
            <code>recordings</code> table with the status <code>queued</code>. If saving fails, no row
            is made and you see the error.
          </li>
          <li>
            The worker picks up the job, checks the file with ffprobe, converts it to 16 kHz mono WAV
            with ffmpeg, and cuts it into parts.
          </li>
          <li>
            Each part goes to Gnani&apos;s speech-to-text API (<code>POST /stt/v3</code> with the
            language code, and <code>format=transcribe</code> so spoken numbers come back as digits).
            Each part&apos;s text is saved the moment it comes back.
          </li>
          <li>
            When every part is done, the texts are joined in order and sent to {LLM_NAME}, which
            writes a couple of sentences and a few bullet points.
          </li>
          <li>The whole time, the recording page asks the API every 2 seconds how far along it is.</li>
        </ol>
        <p>
          Why {LLM_NAME}: it has a free tier, it&apos;s fast, and I call it through its OpenAI-style
          endpoint, so switching to another LLM later is just a change in the settings.
        </p>
      </section>

      <section className="prose">
        <h2>Where files live</h2>
        <p>
          The audio goes into a storage bucket on Railway, under <code>recordings/&lt;random id&gt;/</code>.
          I didn&apos;t keep it on the server&apos;s disk because Railway gives every deploy a fresh
          disk, and the worker runs on a different machine from the API anyway, so it couldn&apos;t see
          that disk.
        </p>
        <p>
          Everything else is in Postgres. The <code>recordings</code> table has one row per upload
          (status, progress, transcript, summary, errors) and the <code>chunks</code> table has one
          row per part of the audio.
        </p>
        <p>
          The audio player on the recording page doesn&apos;t stream through my API. The API just
          redirects the browser to a temporary signed link to the file (valid for 6 hours), and the
          browser plays it straight from the bucket.
        </p>
        <p>
          My first version had the browser upload straight to the bucket with presigned URLs, so the
          file would never pass through my API. That didn&apos;t work out: the first storage I tried
          (Supabase) blocked uploads from the browser with a CORS error, and its free plan caps files
          at 50 MB. So now the file goes browser → API → bucket. It&apos;s simpler, and the cost is
          that the API has to handle the upload. I set the limit to 200 MB.
        </p>
      </section>

      <section className="prose">
        <h2>How I handled long audio</h2>
        <p>
          Gnani&apos;s speech-to-text REST API takes at most 60 seconds of audio per request, and they
          recommend 30. So the worker cuts the audio into parts of 28 seconds or less.
        </p>
        <p>
          I didn&apos;t want to cut in the middle of a word, so it first runs ffmpeg&apos;s{" "}
          <code>silencedetect</code> to find the pauses (quieter than -35 dB for at least 0.4 s) and
          makes each cut at the last pause before the 28 second mark. If someone talks for 28 seconds
          without a single pause, it just cuts at 28.
        </p>
        <p>
          The parts go to Gnani one at a time, and each part&apos;s text is saved as soon as it comes
          back. That&apos;s where the &quot;12 of 40 parts done&quot; on the page comes from. It also
          means a retry only sends the parts that are still missing, so I never pay for the same
          audio twice.
        </p>
        <p>
          I also looked at Gnani&apos;s Batch API, which takes files up to 4 hours. I stayed with parts
          because I get real progress, a failure only costs one part instead of the whole file, and
          the REST API supports all 10 languages. The longest file I tested was 10 minutes (22
          parts). I also ran one of my test files through Gnani&apos;s playground to compare the
          output.
        </p>
      </section>

      <section className="prose">
        <h2>What runs synchronously, and what runs in the background</h2>
        <p>Synchronously, inside the web request:</p>
        <ul>
          <li>saving the upload to the bucket and creating the database row</li>
          <li>returning a recording&apos;s status, transcript and summary</li>
          <li>listing past uploads, and giving out the audio link for the player</li>
        </ul>
        <p>In the background, in the worker:</p>
        <ul>
          <li>checking and converting the audio, finding pauses, cutting it into parts</li>
          <li>sending every part to Gnani</li>
          <li>getting the summary from {LLM_NAME}</li>
        </ul>
        <p>
          The worker is its own process. It takes the next queued job from Postgres with{" "}
          <code>SELECT … FOR UPDATE SKIP LOCKED</code>, so two workers can never grab the same job,
          and restarting the API never loses one. I thought about Redis and Celery, but that&apos;s
          one more service to run, and the job&apos;s status already lives in the{" "}
          <code>recordings</code> table, so Postgres was enough here.
        </p>
      </section>

      <section className="prose">
        <h2>How progress is shown</h2>
        <ul>
          <li>While uploading, the waveform in the upload box fills up as the file goes out, with &quot;x MB of y MB&quot; under it.</li>
          <li>On the recording page, each step is listed (convert, cut, transcribe, summarise), and during transcription you get &quot;12 of 40 parts done&quot; with a bar.</li>
          <li>Transcript parts show up on the page as they finish, so you can start reading before the end.</li>
          <li>In the list of past uploads, anything still running has a small progress bar.</li>
        </ul>
        <p>
          All of this is polling: the page asks every 2 seconds, and the API reads the row that the
          worker keeps updating. You can also close the tab, because the work carries on on the
          server.
        </p>
      </section>

      <section className="prose">
        <h2>When something fails</h2>
        <ul>
          <li>The upload fails or the file is too big: the form says so, and nothing is saved.</li>
          <li>The file isn&apos;t really audio, or it&apos;s damaged: ffprobe catches it before any Gnani credits are spent.</li>
          <li>Gnani is busy or down (429, 5xx, or a timeout): that part is retried after 1, 2 and 4 seconds. If it still fails, the job stops, keeps the finished parts, and the page shows a Retry button.</li>
          <li>Gnani rejects the audio (400): retrying won&apos;t help, so it just shows the message.</li>
          <li>Wrong API key or no credits (401, 403): it says so, and you can retry once it&apos;s fixed.</li>
          <li>The summary fails: you still get the full transcript, with a button that retries only the summary.</li>
          <li>The worker crashes halfway: a job with no progress for 10 minutes is marked as interrupted, with a Retry button.</li>
          <li>The recording is silent: it says &quot;No speech was detected&quot; instead of showing an empty page.</li>
        </ul>
      </section>

      <section className="prose">
        <h2>Problems I ran into</h2>
        <ul>
          <li>
            {LLM_NAME} sometimes replied with HTTP 503, &quot;high demand&quot;. Now the summary is
            retried after 5 and 15 seconds, and if the main model is still busy it falls back to a
            lighter one.
          </li>
          <li>
            After deploying, the {LLM_NAME} key failed on Railway with an &quot;invalid header&quot;
            error. The key I&apos;d pasted into the dashboard had an invisible newline at the end. Now
            every setting is trimmed when the app reads it.
          </li>
          <li>The Supabase CORS and 50 MB problem above, which is why uploads go through the API.</li>
        </ul>
      </section>

      <section className="prose">
        <h2>What I&apos;d do differently with more time</h2>
        <ul>
          <li>Send 3 or 4 parts to Gnani at the same time instead of one by one, so long files finish faster.</li>
          <li>Push progress to the page with server-sent events instead of asking every 2 seconds.</li>
          <li>Add speaker labels with Gnani&apos;s Batch API.</li>
          <li>Resumable uploads straight to the bucket, on storage that allows it, for really big files.</li>
          <li>Summarise very long transcripts in pieces and then combine them.</li>
          <li>Accounts, so people only see their own uploads, and delete old audio after 30 days.</li>
          <li>More tests. Right now only the cutting logic has unit tests.</li>
        </ul>
      </section>
    </>
  );
}
