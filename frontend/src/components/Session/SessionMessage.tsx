import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { Markdown } from "../ui/Markdown";
import { fadeUp } from "../ui/motion";
import { parseCommand } from "./chatCommands";
import type { RenderItem } from "./sessionEvents";

const enter = { variants: fadeUp, initial: "hidden", animate: "show" } as const;

type ScrollRef = React.RefObject<HTMLDivElement | null>;

/** Renders one clean conversation item. Tool calls collapse; system noise is tiny. */
export function SessionMessage({ item, scrollRef }: { item: RenderItem; scrollRef?: ScrollRef }) {
  if (item.kind === "text") {
    if (item.role === "user") return <UserMessage text={item.text} scrollRef={scrollRef} />;
    return (
      <motion.div {...enter} className="flex justify-start">
        <div className="surface-2 max-w-[85%] break-words rounded-2xl rounded-bl-md px-4 py-2.5">
          <div className="eyebrow mb-1 !text-faint">Claude</div>
          <Markdown>{item.text}</Markdown>
        </div>
      </motion.div>
    );
  }

  if (item.kind === "tool_use") {
    return <ToolCard icon="tool" label={item.name} body={stringifyInput(item.input)} tone="use" />;
  }

  if (item.kind === "tool_result") {
    return (
      <ToolCard
        icon={item.isError ? "error" : "toolResult"}
        label={item.isError ? "tool result · error" : "tool result"}
        body={item.content}
        tone={item.isError ? "error" : "result"}
      />
    );
  }

  if (item.kind === "result") {
    return (
      <motion.div {...enter} className="flex justify-start py-1">
        <span className={`pill ${item.isError ? "pill-danger" : "!text-faint"}`}>
          {item.isError ? "session error" : "turn complete"}
        </span>
      </motion.div>
    );
  }

  return null; // system items are rendered in aggregate by SessionTranscript
}

/**
 * A user turn. In flow it's a right-aligned bubble; once it sticks to the top of
 * the scroll area it morphs into a full-width one-line bar (so you always see
 * which question the response belongs to). A sentinel + IntersectionObserver
 * detects the pinned state; Framer's layout animation does the bubble→bar morph.
 */
function UserMessage({ text, scrollRef }: { text: string; scrollRef?: ScrollRef }) {
  const { command, body } = parseCommand(text);
  const tone = command;
  const content = body || text;

  const [stuck, setStuck] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = scrollRef?.current;
    const el = wrapperRef.current;
    if (!root || !el) return;
    // Stuck only when actually pinned: the turn's top has reached the scroll
    // container's top. In its natural position its top sits below that.
    let raf = 0;
    const check = () => {
      raf = 0;
      const offset = el.getBoundingClientRect().top - root.getBoundingClientRect().top;
      setStuck(offset <= 1);
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
  }, [scrollRef]);

  return (
    <motion.div
      {...enter}
      ref={wrapperRef}
      className={`sticky top-0 z-20 flex ${stuck ? "justify-stretch" : "justify-end"}`}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 520, damping: 42 }}
        style={{ borderRadius: stuck ? 10 : 18 }}
        className={`overflow-hidden border backdrop-blur-md ${stuck ? "w-full px-4 py-2" : "max-w-[85%] px-4 py-2.5"} ${
          tone ? `${tone.border} ${tone.bg}` : "border-accent-line bg-accent/15"
        }`}
      >
        <div className={stuck ? "flex min-w-0 items-center gap-2" : "flex flex-col gap-1.5"}>
          {tone && (
            <span className={`flex shrink-0 items-center gap-1.5 font-mono text-[0.66rem] font-semibold uppercase tracking-wider ${tone.text}`}>
              <Icon name={tone.icon} size={13} />
              {tone.label}
            </span>
          )}
          <div
            className={`text-sm leading-relaxed text-ink ${
              stuck ? "min-w-0 flex-1 truncate" : "whitespace-pre-wrap break-words"
            }`}
          >
            {content || <span className="text-muted">(no message)</span>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function stringifyInput(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

function ToolCard({
  icon,
  label,
  body,
  tone,
}: {
  icon: IconName;
  label: string;
  body: string;
  tone: "use" | "result" | "error";
}) {
  const [open, setOpen] = useState(false);
  const accent = tone === "error" ? "text-danger" : tone === "use" ? "text-accent" : "text-success";
  return (
    <motion.div {...enter} className="surface-2 overflow-hidden rounded-lg">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
      >
        <span className={`flex items-center gap-2 font-mono text-xs font-semibold ${accent}`}>
          <Icon name={icon} size={14} />
          {label}
        </span>
        <span className="font-mono text-xs text-faint">{open ? "hide" : "show"}</span>
      </button>
      {open && body && (
        <pre className="m-0 max-h-72 overflow-auto border-t border-line px-3.5 py-2.5 font-mono text-xs leading-relaxed text-muted">
          {body}
        </pre>
      )}
    </motion.div>
  );
}
