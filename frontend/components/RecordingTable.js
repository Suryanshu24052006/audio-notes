import Link from "next/link";
import { formatDuration, languageName, statusSummary, timeAgo } from "../lib/format";

export default function RecordingTable({ recordings }) {
  if (recordings.length === 0) {
    return <p className="muted">Nothing uploaded yet. Your recordings will show up here.</p>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Language</th>
            <th className="num">Length</th>
            <th>Status</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {recordings.map((rec) => {
            const status = statusSummary(rec);
            return (
              <tr key={rec.id}>
                <td><Link href={`/recordings/${rec.id}`}>{rec.filename}</Link></td>
                <td>{languageName(rec.language)}</td>
                <td className="num">{formatDuration(rec.duration_s)}</td>
                <td className={`tone-${status.tone}`}>{status.text}</td>
                <td className="muted">{timeAgo(rec.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
