import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SessionEvent } from "../../hooks/useSession";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import { staggerContainer } from "../ui/motion";
import { SessionMessage } from "./SessionMessage";
import { flattenEvents, meaningfulCount } from "./sessionEvents";

/**
 * Scrollable transcript. Renders the conversation cleanly and quarantines the
 * CLI's internal system/hook events behind a collapsible strip so the chat stays
 * readable. Auto-scrolls to the newest message.
 */
export function SessionTranscript({ events, thinking }: { events: SessionEvent[]; thinking: boolean }) {
  const items = useMemo(() => flattenEvents(events), [events]);
  const systemItems = items.filter((it) => it.kind === "system");
  const visible = items.filter((it) => it.kind !== "system");
  const [showSystem, setShowSystem] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, thinking]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {meaningfulCount(items) === 0 && !thinking && (
          <EmptyState
            icon="▤"
            title="Say something to start"
            hint="Your message runs against the active project on your Claude subscription."
          />
        )}

        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-3">
          {visible.map((item) => (
            <SessionMessage key={item.key} item={item} />
          ))}
        </motion.div>

        {thinking && (
          <div className="surface-2 w-fit rounded-2xl rounded-bl-md px-4 py-3">
            <Spinner label="Claude is working" />
          </div>
        )}

        {systemItems.length > 0 && (
          <div className="mt-2">
            <button onClick={() => setShowSystem((s) => !s)} className="eyebrow hover:text-muted">
              {showSystem ? "▾" : "▸"} {systemItems.length} system event{systemItems.length === 1 ? "" : "s"}
            </button>
            {showSystem && (
              <div className="mt-2 flex flex-col gap-1.5">
                {systemItems.map((it) =>
                  it.kind === "system" ? (
                    <details key={it.key} className="surface-2 rounded-md px-3 py-1.5">
                      <summary className="cursor-pointer font-mono text-xs text-faint">{it.subtype}</summary>
                      <pre className="m-0 mt-2 max-h-60 overflow-auto font-mono text-[11px] leading-relaxed text-muted">
                        {JSON.stringify(it.raw, null, 2)}
                      </pre>
                    </details>
                  ) : null,
                )}
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
