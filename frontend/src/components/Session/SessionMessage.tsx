import { motion } from "framer-motion";
import { useState } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { Markdown } from "../ui/Markdown";
import { fadeUp } from "../ui/motion";
import { parseCommand } from "./chatCommands";
import type { RenderItem } from "./sessionEvents";

const enter = { variants: fadeUp, initial: "hidden", animate: "show" } as const;

/** Renders one clean conversation item. Tool calls collapse; system noise is tiny. */
export function SessionMessage({ item }: { item: RenderItem }) {
  if (item.kind === "text") {
    if (item.role === "user") return <UserMessage text={item.text} />;
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
 * A user turn — sticky to the top of the scroll area so you always see which
 * question the response below belongs to. A leading workflow command (if any)
 * renders as a colored badge.
 */
function UserMessage({ text }: { text: string }) {
  const { command, body } = parseCommand(text);
  return (
    <motion.div {...enter} className="sticky top-0 z-10 flex justify-end">
      {command ? (
        <div className={`max-w-[85%] break-words rounded-2xl rounded-br-md border px-4 py-2.5 backdrop-blur-md ${command.border} ${command.bg}`}>
          <div className={`mb-1.5 flex items-center gap-1.5 font-mono text-[0.66rem] font-semibold uppercase tracking-wider ${command.text}`}>
            <Icon name={command.icon} size={13} />
            {command.label}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{body || <span className="text-muted">(no message)</span>}</div>
        </div>
      ) : (
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm leading-relaxed text-[#1a1205]">
          {text}
        </div>
      )}
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
