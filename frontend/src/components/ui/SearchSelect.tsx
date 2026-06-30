import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * A custom search-select dropdown that matches the app's BranchPicker: a styled
 * trigger, an animated popover with a search box, and a filtered option list.
 * Controlled — the parent owns the value. Replaces the native <select> so the
 * menu is themed (the OS dropdown is not).
 */
interface Props {
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  icon?: IconName;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
}

export function SearchSelect({
  value,
  options,
  onSelect,
  disabled,
  icon,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyLabel = "No matches",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const pick = (option: string) => {
    if (option !== value) onSelect(option);
    close();
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title={value}
        className="field flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {icon && <Icon name={icon} size={13} className="shrink-0 text-accent" />}
        <span className="min-w-0 flex-1 truncate text-left font-mono text-sm">
          {value || placeholder}
        </span>
        <Icon name="chevronDown" size={12} className="shrink-0 text-faint" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={close} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
              className="surface absolute left-0 top-full z-30 mt-1 w-64 p-1.5"
            >
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="field mb-1 !py-1.5 text-xs"
              />
              <div className="max-h-56 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-faint">{emptyLabel}</p>
                )}
                {filtered.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => pick(option)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-surface-2 ${
                      option === value ? "text-accent" : "text-muted"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate font-mono">{option}</span>
                    {option === value && <Icon name="success" size={12} className="shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
