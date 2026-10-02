// made-up bar heights (in %) that look a bit like speech. worked out once with a formula
// instead of Math.random, so the server and the browser draw the same bars
const HEIGHTS = Array.from({ length: 64 }, (_, i) =>
  Math.round(18 + 62 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.31)) + (i % 5) * 4)
);

// filled: how much is coloured in, from 0 to 1. the upload form uses it as the progress bar
export default function Waveform({ filled = 0, state = "idle" }) {
  const lit = Math.round(filled * HEIGHTS.length);

  return (
    <div className={`wave wave-${state}`} aria-hidden="true">
      {HEIGHTS.map((height, i) => (
        <span
          key={i}
          className={i < lit ? "lit" : undefined}
          style={{ height: `${height}%`, animationDelay: `${(i % 8) * 90}ms` }}
        />
      ))}
    </div>
  );
}
