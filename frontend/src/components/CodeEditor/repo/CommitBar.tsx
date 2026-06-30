import { useState } from "react";
import { Icon } from "../../ui/Icon";

interface Props {
  stagedCount: number;
  committing: boolean;
  onCommit: (message: string) => void;
}

/** Commit message box + button. Commit is enabled only with staged files and a message. */
export function CommitBar({ stagedCount, committing, onCommit }: Props) {
  const [message, setMessage] = useState("");
  const canCommit = stagedCount > 0 && message.trim().length > 0 && !committing;

  const submit = () => {
    if (!canCommit) return;
    onCommit(message.trim());
    setMessage("");
  };

  return (
    <div className="border-t border-line p-3">
      <textarea
        className="field w-full"
        rows={2}
        placeholder={stagedCount > 0 ? "Commit message" : "Stage files to commit"}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-faint">{stagedCount} staged</span>
        <button type="button" className="btn btn-primary" disabled={!canCommit} onClick={submit}>
          <Icon name="commit" size={15} />
          {committing ? "Committing…" : "Commit"}
        </button>
      </div>
    </div>
  );
}
