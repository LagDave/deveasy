import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

/**
 * Small circular gauge for context-window usage. Click to open an animated popover
 * with the expanded numbers + a bar. Pure presentational SVG (no chart dep, §4.4);
 * data comes from the session's latest result event (or the model's max until then).
 */
interface ContextRingProps {
  used: number;
  window: number;
}

const SIZE = 18;
const STROKE = 2.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

/** Compact token count: 64000 -> "64k", 486300 -> "486.3k", 1_000_000 -> "1M". */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`.replace(".0M", "M");
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`.replace(".0k", "k");
  return String(n);
}

export function ContextRing({ used, window }: ContextRingProps) {
  const [open, setOpen] = useState(false);
  const pct = window > 0 ? Math.min(used / window, 1) : 0;
  const pctInt = Math.round(pct * 100);
  const offset = CIRC * (1 - pct);
  const colorClass = pct >= 0.9 ? "text-danger" : pct >= 0.7 ? "text-accent" : "text-success";
  const label = `Context: ${fmt(used)} / ${fmt(window)} (${pctInt}%)`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid place-items-center rounded-full p-0.5 hover:bg-surface-2"
        title={label}
        aria-label={label}
      >
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
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 520, damping: 38 }}
              className="surface absolute bottom-full right-0 z-20 mb-2 w-60 p-3"
            >
              <p className="eyebrow mb-1">Context window</p>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-sm text-ink">
                  {fmt(used)} / {fmt(window)}
                </span>
                <span className={`font-mono text-xs ${colorClass}`}>{pctInt}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className={`h-full rounded-full bg-current ${colorClass}`}
                  style={{ width: `${pctInt}%`, transition: "width 0.4s ease" }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
