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
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;600&display=swap"
        />
      </head>
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand">audio notes</Link>
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
            <span>Made by Suryanshu Chandel for the Gnani internship task.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
