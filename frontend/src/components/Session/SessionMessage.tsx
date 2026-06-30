import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { Markdown } from "../ui/Markdown";
import { fadeUp } from "../ui/motion";
import { isSeedTurnText, stripWizardBlocks } from "../CreateProject/wizardProtocol";
import { parseCommand } from "./chatCommands";
import { skillLoadName, type RenderItem } from "./sessionEvents";

const enter = { variants: fadeUp, initial: "hidden", animate: "show" } as const;

type ScrollRef = React.RefObject<HTMLDivElement | null>;

/** Renders one clean conversation item. Tool calls collapse; system noise is tiny. */
export function SessionMessage({ item, scrollRef }: { item: RenderItem; scrollRef?: ScrollRef }) {
  if (item.kind === "text") {
    const skill = skillLoadName(item.text);
    if (skill) return <SkillChip name={skill} />;
    if (item.role === "user") {
      if (isSeedTurnText(item.text)) return null; // the technical wizard seed turn
      return <UserMessage text={item.text} scrollRef={scrollRef} />;
    }
    // Hide raw deveasy-question/done JSON — it renders as buttons by the composer.
    const prose = stripWizardBlocks(item.text);
    if (!prose) return null;
    return (
      <motion.div {...enter} className="flex justify-start">
        <div className="surface-2 max-w-[85%] break-words rounded-2xl rounded-bl-md px-4 py-2.5">
          <div className="eyebrow mb-1 !text-faint">Claude</div>
          <Markdown>{prose}</Markdown>
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

  if (item.kind === "notice") {
    return (
      <motion.div {...enter} className="flex justify-center py-1">
        <span className="surface-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[0.7rem] text-faint">
          <Icon name="instant" size={12} />
          {item.text}
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
  // Only pin (and morph to a bar) when the turn is tall enough to scroll the
  // question out of view — short threads just stay a bubble in flow.
  const [pinnable, setPinnable] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = scrollRef?.current;
    const el = wrapperRef.current;
    if (!root || !el) return;
    const padTop = parseFloat(getComputedStyle(root).paddingTop) || 0;
    let raf = 0;
    const check = () => {
      raf = 0;
      // The turn is its parent group div: only worth pinning if it's clearly
      // taller than the viewport (otherwise the whole turn fits on screen).
      const group = el.parentElement;
      const tall = group ? group.offsetHeight > root.clientHeight * 1.0 : false;
      setPinnable(tall);
      const offset = el.getBoundingClientRect().top - root.getBoundingClientRect().top;
      setStuck(tall && offset <= padTop + 1);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => check());
    if (el.parentElement) ro.observe(el.parentElement);
    check();
    return () => {
      root.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollRef]);

  return (
    <motion.div
      {...enter}
      ref={wrapperRef}
      className={`flex ${pinnable ? "sticky top-0 z-20" : ""} ${stuck ? "justify-stretch" : "justify-end"}`}
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

/** One-line stand-in for a skill-load dump (the full SKILL.md is never shown). */
function SkillChip({ name }: { name: string }) {
  return (
    <motion.div {...enter} className="flex justify-start py-0.5">
      <span className="surface-2 inline-flex items-center gap-2 truncate rounded-full px-3 py-1.5 font-mono text-xs text-faint">
        <Icon name="skill" size={13} />
        Using skill: {name}
      </span>
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
