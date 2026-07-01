import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { QueueItem } from "../../hooks/useSession";
import { Icon } from "../ui/Icon";

/**
 * Queued-message indicator: a circular badge showing how many messages are waiting
 * to auto-send after the current turn. Click to open an editable list — each item's
 * text is editable in place and can be removed; the whole queue can be cleared.
 */
interface Props {
  items: QueueItem[];
  onUpdate: (id: number, text: string) => void;
  onRemove: (id: number) => void;
  onClear: () => void;
}

export function MessageQueue({ items, onUpdate, onRemove, onClear }: Props) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid h-7 w-7 place-items-center rounded-full border border-accent-line bg-accent/15 font-mono text-xs font-bold text-accent"
        title={`${items.length} queued message${items.length === 1 ? "" : "s"}`}
        aria-label={`${items.length} queued`}
      >
        {items.length}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 520, damping: 38 }}
              className="surface absolute bottom-full right-0 z-20 mb-2 w-80 p-2"
            >
              <div className="flex items-center justify-between px-1 pb-1.5">
                <p className="eyebrow">Queued · auto-sends after this turn</p>
                <button type="button" onClick={onClear} className="text-xs text-faint hover:text-danger">
                  Clear
                </button>
              </div>
              <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                {items.map((it, i) => (
                  <div key={it.id} className="surface-2 rounded-md p-2">
                    <div className="flex items-center justify-between pb-1">
                      <span className="eyebrow">#{i + 1}</span>
                      <button
                        type="button"
                        onClick={() => onRemove(it.id)}
                        className="grid h-5 w-5 place-items-center rounded text-faint hover:text-danger"
                        title="Remove"
                      >
                        <Icon name="delete" size={13} />
                      </button>
                    </div>
                    <textarea
                      value={it.text}
                      onChange={(e) => onUpdate(it.id, e.target.value)}
                      rows={2}
                      className="w-full resize-none bg-transparent text-sm leading-relaxed text-ink outline-none"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
