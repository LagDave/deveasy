import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { QueueItem } from "../../hooks/useSession";
import { Icon } from "../ui/Icon";

/**
 * Queued-message indicator: a small circular count badge (sized to match the
 * context ring) showing how many messages will auto-send after the current turn.
 * Click to open an editable list — each item grows to its content (capped) and can
 * be edited or removed; the whole queue can be cleared.
 */
interface Props {
  items: QueueItem[];
  onUpdate: (id: number, text: string) => void;
  onRemove: (id: number) => void;
  onClear: () => void;
}

const MAX_ITEM_PX = 160;

/** One queued message — a textarea that auto-grows to its content up to a cap. */
function QueuedRow({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: QueueItem;
  index: number;
  onUpdate: (id: number, text: string) => void;
  onRemove: (id: number) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ITEM_PX)}px`;
  }, [item.text]);

  return (
    <div className="surface-2 flex items-start gap-2 rounded-md p-2">
      <span className="eyebrow shrink-0 pt-1.5">{index + 1}</span>
      <textarea
        ref={ref}
        value={item.text}
        onChange={(e) => onUpdate(item.id, e.target.value)}
        rows={1}
        className="min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-1 text-sm leading-relaxed text-ink outline-none"
      />
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-faint hover:text-danger"
        title="Remove"
      >
        <Icon name="delete" size={13} />
      </button>
    </div>
  );
}

export function MessageQueue({ items, onUpdate, onRemove, onClear }: Props) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid h-[18px] w-[18px] place-items-center rounded-full border border-accent-line bg-accent/15 font-mono text-[10px] font-bold leading-none text-accent"
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
              className="surface absolute bottom-full right-0 z-20 mb-2 w-[28rem] max-w-[80vw] p-2.5"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="eyebrow truncate">Queued · auto-sends next</p>
                <button
                  type="button"
                  onClick={onClear}
                  className="shrink-0 text-xs text-faint hover:text-danger"
                >
                  Clear
                </button>
              </div>
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {items.map((it, i) => (
                  <QueuedRow key={it.id} item={it} index={i} onUpdate={onUpdate} onRemove={onRemove} />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
