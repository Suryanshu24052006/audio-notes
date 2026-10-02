// just made-up heights (%) so it looks like a sound wave. 32 bars, drawn twice
const SHAPE = [30, 55, 40, 70, 45, 85, 60, 35, 50, 90, 65, 40, 75, 55, 30, 45,
  80, 60, 95, 50, 35, 65, 85, 45, 55, 70, 40, 60, 90, 50, 35, 25];
const HEIGHTS = [...SHAPE, ...SHAPE];

// filled = 0 to 1, how much of the upload is done
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
