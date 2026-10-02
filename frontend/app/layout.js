import Link from "next/link";
import { LLM_NAME, REPO_URL } from "../lib/site";
import "./globals.css";

export const metadata = {
  title: "audio notes",
  description: "Upload a recording and get back a transcript and a summary.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand">
              {/* same four bars as the tab icon (app/icon.svg) */}
              <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
                <rect width="32" height="32" rx="7" fill="currentColor" />
                <g stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="8" y1="13" x2="8" y2="19" />
                  <line x1="13" y1="9" x2="13" y2="23" />
                  <line x1="18" y1="11" x2="18" y2="21" />
                  <line x1="23" y1="14" x2="23" y2="18" />
                </g>
              </svg>
              audio notes
            </Link>
            <nav>
              <Link href="/">Upload</Link>
              <Link href="/architecture">Architecture</Link>
              <a href={REPO_URL}>GitHub</a>
            </nav>
          </div>
        </header>

        <main className="wrap">{children}</main>

        <footer className="site-footer">
          <div className="wrap">
            <span>Transcripts by Gnani ASR. Summaries by {LLM_NAME}.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
