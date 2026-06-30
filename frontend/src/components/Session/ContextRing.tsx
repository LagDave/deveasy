/**
 * Small circular gauge showing how much of the model's context window the current
 * session has used. Pure presentational SVG (no chart dependency, §4.4); data comes
 * from the session's latest `result` event via useSession.
 */
interface ContextRingProps {
  used: number;
  window: number;
}

const SIZE = 30;
const STROKE = 3.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

/** Compact token count: 64000 -> "64k", 1_000_000 -> "1M". */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function ContextRing({ used, window }: ContextRingProps) {
  const pct = window > 0 ? Math.min(used / window, 1) : 0;
  const offset = CIRC * (1 - pct);
  // Calm under 70%, warn approaching the ceiling.
  const colorClass = pct >= 0.9 ? "text-danger" : pct >= 0.7 ? "text-accent" : "text-success";
  const label = `Context: ${fmt(used)} / ${fmt(window)} (${Math.round(pct * 100)}%)`;

  return (
    <div className="relative grid place-items-center" title={label} aria-label={label}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-line"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          className={colorClass}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <span className="absolute font-mono text-[8px] font-semibold text-faint">
        {Math.round(pct * 100)}
      </span>
    </div>
  );
}
