import { useState } from "react";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";
import { SessionMessage } from "./SessionMessage";
import type { RenderItem } from "./sessionEvents";

/**
 * Collapses a run of consecutive tool calls into one expandable row so a long
 * agentic turn doesn't stack dozens of cards. While the turn is live, the row
 * doubles as the "Claude is working… {latest tool}" indicator.
 */
export function SessionToolGroup({ items, live }: { items: RenderItem[]; live: boolean }) {
  const [open, setOpen] = useState(false);

  const toolCount = items.filter((i) => i.kind === "tool_use").length;
  const latest = [...items].reverse().find((i) => i.kind === "tool_use");
  const latestName = latest && latest.kind === "tool_use" ? latest.name : "tool";

  return (
    <div className={`surface-2 overflow-hidden rounded-lg ${live ? "border border-accent-line" : ""}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left">
        {live ? (
          <Spinner label={`Claude is working · ${latestName}`} />
        ) : (
          <span className="flex items-center gap-2 font-mono text-xs text-muted">
            <Icon name="tool" size={14} className="text-faint" />
            {toolCount} tool {toolCount === 1 ? "step" : "steps"}
          </span>
        )}
        <span className="ml-auto font-mono text-xs text-faint">{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 border-t border-line p-2">
          {items.map((it) => (
            <SessionMessage key={it.key} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}
