import { useState } from "react";
import type { UsageWindow } from "../../api/usage";
import { useUsageLimits } from "../../hooks/queries/useUsageQueries";

/**
 * Subscription usage gauge for the top of the sidebar: two concentric rings —
 * outer = 5-hour window, inner = weekly — each filled by utilization. Clicking
 * opens a breakdown with a horizontal bar and reset time per window. Pure SVG/CSS
 * (no chart dependency, §4.4). Degrades to a muted "—" when the endpoint is
 * unavailable, so an upstream outage never breaks the rail (§3.1).
 */

const SIZE = 20;
const STROKE = 2;
const OUTER_R = (SIZE - STROKE) / 2;
const INNER_R = OUTER_R - STROKE - 0.75;

/** Tailwind text token for a utilization level (higher = closer to the limit). */
function levelClass(util: number): string {
  if (util >= 85) return "text-danger";
  if (util >= 60) return "text-accent";
  return "text-success";
}

/** "resets in 3h 12m" / "resets in 2d 4h" from an ISO timestamp. */
function resetLabel(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "resetting…";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `resets in ${Math.floor(h / 24)}d ${h % 24}h`;
  if (h >= 1) return `resets in ${h}h ${m}m`;
  return `resets in ${m}m`;
}

function Arc({ radius, util, dim }: { radius: number; util: number; dim: boolean }) {
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - Math.min(util / 100, 1));
  return (
    <>
      <circle cx={SIZE / 2} cy={SIZE / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={STROKE} className="text-line" />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className={dim ? "text-faint" : levelClass(util)}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </>
  );
}

function WindowRow({ label, win }: { label: string; win: UsageWindow | null }) {
  const util = win?.utilization ?? 0;
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-muted">{label}</span>
        <span className="font-mono text-faint">{Math.round(util)}% used</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full bg-current ${levelClass(util)}`}
          style={{ width: `${Math.min(util, 100)}%`, transition: "width 0.5s ease" }}
        />
      </div>
      <p className="mt-1 text-[10px] text-faint">{win ? resetLabel(win.resetsAt) : "unavailable"}</p>
    </div>
  );
}

export function UsageRing() {
  const { data, isLoading } = useUsageLimits();
  const [open, setOpen] = useState(false);

  const available = Boolean(data?.available);
  const fiveHour = data?.fiveHour ?? null;
  const sevenDay = data?.sevenDay ?? null;
  const dim = !available;
  const title = available
    ? `5h: ${Math.round(fiveHour?.utilization ?? 0)}% · weekly: ${Math.round(sevenDay?.utilization ?? 0)}%`
    : isLoading
      ? "Loading usage…"
      : "Usage unavailable";

  return (
    <div className="relative border-b border-line px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 text-left"
        title={title}
        aria-label={title}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90 shrink-0">
          <Arc radius={OUTER_R} util={fiveHour?.utilization ?? 0} dim={dim} />
          <Arc radius={INNER_R} util={sevenDay?.utilization ?? 0} dim={dim} />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Usage</p>
          {available ? (
            <p className="font-mono text-xs text-muted">
              5h {Math.round(fiveHour?.utilization ?? 0)}% · wk {Math.round(sevenDay?.utilization ?? 0)}%
            </p>
          ) : (
            <p className="font-mono text-xs text-faint">{isLoading ? "…" : "—"}</p>
          )}
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="surface absolute left-4 right-4 top-full z-20 mt-1 p-3">
            <p className="eyebrow mb-1">Subscription limits</p>
            <WindowRow label="5-hour" win={available ? fiveHour : null} />
            <WindowRow label="Weekly" win={available ? sevenDay : null} />
            {!available && (
              <p className="mt-1 text-[10px] text-faint">
                Limit data is unavailable right now. It refreshes automatically.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
