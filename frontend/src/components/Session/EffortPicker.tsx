import { useState } from "react";
import { effortLabel } from "../../utils/modelLabels";
import { Icon } from "../ui/Icon";

/**
 * Thinking-effort picker (the CLI's `--effort`). Offers the levels the active model
 * supports; renders nothing when the model doesn't support effort (e.g. Haiku).
 */
interface Props {
  levels: string[];
  selectedEffort: string | null;
  disabled: boolean;
  onSelect: (level: string) => void;
}

export function EffortPicker({ levels, selectedEffort, disabled, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  if (levels.length === 0) return null;

  const choose = (level: string) => {
    onSelect(level);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="btn btn-ghost !px-2.5 !py-1.5 disabled:opacity-50"
        title={disabled ? "Change effort when idle" : "Thinking effort"}
      >
        <Icon name="brain" size={14} />
        <span className="font-mono text-xs">{effortLabel(selectedEffort)}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="surface absolute bottom-full right-0 z-20 mb-2 w-40 p-1">
            <p className="eyebrow px-2.5 py-1">Thinking effort</p>
            {levels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => choose(level)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-2 ${
                  level === selectedEffort ? "bg-surface-2" : ""
                }`}
              >
                <span>{effortLabel(level)}</span>
                {level === selectedEffort && <Icon name="done" size={13} className="text-success" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
