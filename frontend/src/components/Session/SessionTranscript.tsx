import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionEvent } from "../../hooks/useSession";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";
import { Markdown } from "../ui/Markdown";
import { Spinner } from "../ui/Spinner";
import { SessionMessage } from "./SessionMessage";
import { SessionToolGroup } from "./SessionToolGroup";
import { flattenEvents, meaningfulCount, type RenderItem } from "./sessionEvents";

/** A render unit within a turn: a single message, or a collapsed run of tools. */
type Unit = { kind: "item"; item: RenderItem } | { kind: "tools"; items: RenderItem[]; key: string };

/** Group items into turns (a user message starts one); batch consecutive tools. */
function buildTurns(items: RenderItem[]): Unit[][] {
  const turns: RenderItem[][] = [];
  for (const it of items) {
    if ((it.kind === "text" && it.role === "user") || turns.length === 0) turns.push([it]);
    else turns[turns.length - 1].push(it);
  }
  return turns.map((turn) => {
    const units: Unit[] = [];
    let i = 0;
    while (i < turn.length) {
      const it = turn[i];
      if (it.kind === "tool_use" || it.kind === "tool_result") {
        const group: RenderItem[] = [];
        while (i < turn.length && (turn[i].kind === "tool_use" || turn[i].kind === "tool_result")) {
          group.push(turn[i]);
          i++;
        }
        units.push({ kind: "tools", items: group, key: group[0].key });
      } else {
        units.push({ kind: "item", item: it });
        i++;
      }
    }
    return units;
  });
}

const NEAR_BOTTOM_PX = 80;

/**
 * Scrollable transcript. Auto-follows new content only while the viewer is at the
 * bottom; scrolling up stops the follow and surfaces a "Show latest" pill instead
 * of fighting the user. Tool runs collapse into one expandable row.
 */
export function SessionTranscript({
  events,
  thinking,
  partialText,
}: {
  events: SessionEvent[];
  thinking: boolean;
  partialText: string;
}) {
  const items = useMemo(() => flattenEvents(events), [events]);
  const systemItems = items.filter((it) => it.kind === "system");
  const visible = items.filter((it) => it.kind !== "system");
  const turns = useMemo(() => buildTurns(visible), [visible]);
  const [showSystem, setShowSystem] = useState(false);

  // A live tool group (trailing tools of the last turn while streaming) shows the
  // working indicator itself, so the standalone spinner is suppressed then.
  const liveTools = thinking && turns.at(-1)?.at(-1)?.kind === "tools";

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const firstScroll = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // Track whether the viewer is parked at the bottom (drives auto-follow).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      const distance = root.scrollHeight - root.scrollTop - root.clientHeight;
      setAtBottom(distance < NEAR_BOTTOM_PX);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    check();
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Follow new content only when already at the bottom (don't fight scroll-up).
  useEffect(() => {
    if (firstScroll.current) {
      scrollToBottom("auto");
      firstScroll.current = false;
      return;
    }
    if (atBottom) scrollToBottom("smooth");
  }, [items.length, thinking, partialText, atBottom, scrollToBottom]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {meaningfulCount(items) === 0 && !thinking && !partialText && (
            <EmptyState
              icon={<Icon name="sessions" size={26} />}
              title="Say something to start"
              hint="Your message runs against the selected project on your Claude subscription."
            />
          )}

          {turns.map((units, ti) => {
            const isLastTurn = ti === turns.length - 1;
            return (
              <div key={units[0] ? unitKey(units[0]) : ti} className="flex flex-col gap-3">
                {units.map((unit, ui) =>
                  unit.kind === "item" ? (
                    <SessionMessage key={unit.item.key} item={unit.item} scrollRef={scrollRef} />
                  ) : (
                    <SessionToolGroup
                      key={unit.key}
                      items={unit.items}
                      live={Boolean(thinking && isLastTurn && ui === units.length - 1)}
                    />
                  ),
                )}
              </div>
            );
          })}

          {/* Live, token-streaming assistant text (not yet committed). */}
          {partialText && (
            <div className="flex justify-start">
              <div className="surface-2 max-w-[85%] break-words rounded-2xl rounded-bl-md px-4 py-2.5">
                <div className="eyebrow mb-1 !text-faint">Claude</div>
                <Markdown>{partialText}</Markdown>
              </div>
            </div>
          )}

          {thinking && !partialText && !liveTools && (
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

      {/* Floating follow control — only when the viewer has scrolled up. */}
      <AnimatePresence>
        {!atBottom && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => {
              setAtBottom(true);
              scrollToBottom("smooth");
            }}
            className="btn btn-primary absolute bottom-4 left-1/2 -translate-x-1/2 shadow-lg"
          >
            <Icon name="continue" size={14} className="rotate-90" />
            Show latest
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function unitKey(unit: Unit): string {
  return unit.kind === "item" ? unit.item.key : unit.key;
}
