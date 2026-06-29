import { useState } from "react";

/**
 * Message input. Renders a textarea + send button; lifts the submitted text to the
 * parent which owns the WS send (Constitution §13.3 — the component renders).
 */
interface SessionComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function SessionComposer({ onSend, disabled }: SessionComposerProps) {
  const [text, setText] = useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="session-composer">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={disabled ? "Connecting…" : "Message Claude (Cmd/Ctrl+Enter to send)"}
        rows={3}
      />
      <button onClick={submit} disabled={disabled || text.trim().length === 0}>
        Send
      </button>
    </div>
  );
}
