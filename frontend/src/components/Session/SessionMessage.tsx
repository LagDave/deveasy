import { motion } from "framer-motion";
import { useState } from "react";
import { Markdown } from "../ui/Markdown";
import { fadeUp } from "../ui/motion";
import type { RenderItem } from "./sessionEvents";

/** Renders one clean conversation item. Tool calls collapse; system noise is tiny. */
export function SessionMessage({ item }: { item: RenderItem }) {
  if (item.kind === "text") {
    const isUser = item.role === "user";
    return (
      <motion.div variants={fadeUp} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[85%] break-words rounded-2xl px-4 py-2.5 ${
            isUser
              ? "whitespace-pre-wrap rounded-br-md bg-accent text-sm leading-relaxed text-[#1a1205]"
              : "surface-2 rounded-bl-md"
          }`}
        >
          {isUser ? (
            item.text
          ) : (
            <>
              <div className="eyebrow mb-1 !text-faint">Claude</div>
              <Markdown>{item.text}</Markdown>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  if (item.kind === "tool_use") {
    return <ToolCard label={`⚙ ${item.name}`} body={stringifyInput(item.input)} tone="use" />;
  }

  if (item.kind === "tool_result") {
    return (
      <ToolCard
        label={item.isError ? "⚠ tool result · error" : "↳ tool result"}
        body={item.content}
        tone={item.isError ? "error" : "result"}
      />
    );
  }

  if (item.kind === "result") {
    return (
      <motion.div variants={fadeUp} className="flex justify-center py-1">
        <span className={`pill ${item.isError ? "pill-danger" : "pill-success"}`}>
          {item.isError ? "session error" : "turn complete"}
        </span>
      </motion.div>
    );
  }

  return null; // system items are rendered in aggregate by SessionTranscript
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

function ToolCard({ label, body, tone }: { label: string; body: string; tone: "use" | "result" | "error" }) {
  const [open, setOpen] = useState(false);
  const accent =
    tone === "error" ? "text-danger" : tone === "use" ? "text-accent" : "text-success";
  return (
    <motion.div variants={fadeUp} className="surface-2 overflow-hidden rounded-lg">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left"
      >
        <span className={`font-mono text-xs font-semibold ${accent}`}>{label}</span>
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
