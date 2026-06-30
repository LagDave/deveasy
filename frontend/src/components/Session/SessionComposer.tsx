import { useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { COMMAND_PRESETS, parseCommand } from "./chatCommands";

/**
 * Message input. A message is only sendable when it begins with a recognized
 * workflow command — type one or pick a preset. The input takes the active
 * command's color + icon. Enter sends, Shift+Enter inserts a newline.
 */
interface SessionComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
  hint?: string;
}

const MAX_ROWS_PX = 200;

export function SessionComposer({ onSend, disabled, hint }: SessionComposerProps) {
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const trimmed = text.trim();
  const active = parseCommand(trimmed).command;
  const missingCommand = trimmed.length > 0 && !active;
  const canSend = !disabled && trimmed.length > 0 && Boolean(active);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  };

  const setText2 = (next: string) => {
    setText(next);
    requestAnimationFrame(grow);
  };

  /** Set or replace the leading command flag, keeping the message body. */
  const applyPreset = (flag: string) => {
    const { body } = parseCommand(text);
    setText2(`${flag} ${body}`.trimEnd() + (body ? "" : " "));
    setMenuOpen(false);
    ref.current?.focus();
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

  const borderClass = active
    ? active.border
    : missingCommand
      ? "border-danger/50"
      : "focus-within:border-accent-line";

  return (
    <div className="border-t border-line px-6 py-4">
      <div className="mx-auto max-w-3xl">
        <div className={`surface flex items-end gap-2 p-2 ${borderClass}`}>
          {/* Command picker / active-command indicator */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={disabled}
              className={`btn !px-2.5 !py-1.5 ${active ? `${active.text} ${active.border} ${active.bg}` : "btn-ghost"}`}
              title="Pick a command"
            >
              <Icon name={active?.icon ?? "add"} size={15} />
              <span className="font-mono text-xs">{active ? active.label : "Command"}</span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="surface absolute bottom-full left-0 z-20 mb-2 max-h-72 w-52 overflow-y-auto p-1">
                  {COMMAND_PRESETS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => applyPreset(c.flag)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-surface-2"
                    >
                      <span className={c.text}>
                        <Icon name={c.icon} size={15} />
                      </span>
                      <span className="flex-1 text-sm">{c.label}</span>
                      <span className="font-mono text-xs text-faint">{c.flag}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText2(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={disabled ? "Waiting for the session…" : "Message Claude…"}
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
              ? "Start with a valid command or select from a preset"
              : (hint ?? "Enter to send · Shift+Enter for a new line")}
        </p>
      </div>
    </div>
  );
}
