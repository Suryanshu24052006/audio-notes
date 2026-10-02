"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDuration, languageName, statusSummary, timeAgo } from "../lib/format";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "done", label: "Done" },
  { key: "progress", label: "In progress" },
  { key: "failed", label: "Failed" },
];

export default function RecordingTable({ recordings }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  if (recordings.length === 0) {
    return <p className="empty">Nothing uploaded yet. Your recordings will show up here.</p>;
  }

  const rows = recordings.map((rec) => ({ rec, status: statusSummary(rec) }));

  // how many recordings each filter button would show
  const counts = { all: rows.length };
  for (const { status } of rows) counts[status.group] = (counts[status.group] || 0) + 1;

  const query = search.trim().toLowerCase();
  const shown = rows.filter(
    ({ rec, status }) =>
      (filter === "all" || status.group === filter) && rec.filename.toLowerCase().includes(query)
  );

  function showAll() {
    setSearch("");
    setFilter("all");
  }

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          className="search"
          placeholder="Search by file name"
          aria-label="Search past uploads by file name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="filters" role="group" aria-label="Show uploads by status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="filter"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className="count">{counts[f.key] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <p>No uploads match{query && ` "${search.trim()}"`}{filter !== "all" && " with this status"}.</p>
          <button type="button" className="button button-plain" onClick={showAll}>Show all uploads</button>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="uploads">
            <thead>
              <tr>
                <th>File</th>
                <th className="col-lang">Language</th>
                <th className="num">Length</th>
                <th>Status</th>
                <th className="col-date">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ rec, status }) => (
                // clicking anywhere on the row opens it. the link stays for keyboard users,
                // and stopPropagation so ctrl+click on the link doesn't also open it here
                <tr key={rec.id} onClick={() => router.push(`/recordings/${rec.id}`)}>
                  <td className="file">
                    <Link href={`/recordings/${rec.id}`} onClick={(event) => event.stopPropagation()}>
                      {rec.filename}
                    </Link>
                  </td>
                  <td className="col-lang">{languageName(rec.language)}</td>
                  <td className="num">{formatDuration(rec.duration_s)}</td>
                  <td><StatusPill rec={rec} status={status} /></td>
                  <td className="col-date muted">{timeAgo(rec.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StatusPill({ rec, status }) {
  const percent = rec.chunks_total ? Math.round((rec.chunks_done / rec.chunks_total) * 100) : 0;
  return (
    <span className="status-cell">
      <span className={`pill pill-${status.tone}`}>{status.text}</span>
      {rec.status === "transcribing" && (
        <span className="mini-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${percent}%` }} />
        </span>
      )}
    </span>
  );
}
