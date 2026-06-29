import { useRef, useState } from "react";

/**
 * Message input. Auto-growing textarea; Enter sends, Shift+Enter inserts a newline.
 * Lifts the submitted text to the parent which owns the WS send (Constitution §13.3).
 */
interface SessionComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
  hint?: string;
}

const MAX_ROWS_PX = 200;

export function SessionComposer({ onSend, disabled, hint }: SessionComposerProps) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
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
        <div className="surface flex items-end gap-2 p-2 focus-within:border-accent-line">
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              grow();
            }}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={disabled ? "Waiting for the session…" : "Message Claude…"}
            rows={1}
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-ink outline-none placeholder:text-faint disabled:opacity-60"
          />
          <button onClick={submit} disabled={disabled || text.trim().length === 0} className="btn btn-primary">
            Send
          </button>
        </div>
        <p className="eyebrow mt-2 px-1">
          {hint ?? "Enter to send · Shift+Enter for a new line"}
        </p>
      </div>
    </div>
  );
}
