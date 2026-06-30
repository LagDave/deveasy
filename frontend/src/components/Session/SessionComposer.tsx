import { useRef, useState } from "react";
import { parseCommand } from "./chatCommands";

/**
 * Message input. Auto-growing textarea; Enter sends, Shift+Enter inserts a newline.
 * A message is only sendable when it begins with a recognized workflow command
 * (the CLAUDE.md command gate) — we block bare prompts in code rather than relying
 * on Claude to bounce them back. Lifts the text to the parent (Constitution §13.3).
 */
interface SessionComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
  hint?: string;
}

const MAX_ROWS_PX = 200;
const COMMAND_LEGEND = "-s plan · -i instant · -x execute · -a ask · -c continue · -q quickfix · -b explore · -r review · -st status";

export function SessionComposer({ onSend, disabled, hint }: SessionComposerProps) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const trimmed = text.trim();
  const hasCommand = parseCommand(trimmed).command !== null;
  const missingCommand = trimmed.length > 0 && !hasCommand;
  const canSend = !disabled && trimmed.length > 0 && hasCommand;

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  };

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setText("");
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = "auto";
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-line px-6 py-4">
      <div className="mx-auto max-w-3xl">
        <div
          className={`surface flex items-end gap-2 p-2 ${
            missingCommand ? "!border-danger/50" : "focus-within:border-accent-line"
          }`}
        >
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              grow();
            }}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={disabled ? "Waiting for the session…" : "Start with a command, e.g. -a what does this repo do?"}
            rows={1}
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-ink outline-none placeholder:text-faint disabled:opacity-60"
          />
          <button onClick={submit} disabled={!canSend} className="btn btn-primary">
            Send
          </button>
        </div>
        <p className={`eyebrow mt-2 px-1 ${missingCommand ? "!text-danger" : ""}`}>
          {disabled
            ? (hint ?? "Waiting for the session…")
            : missingCommand
              ? `A command is required — ${COMMAND_LEGEND}`
              : (hint ?? "Enter to send · Shift+Enter for a new line")}
        </p>
      </div>
    </div>
  );
}
