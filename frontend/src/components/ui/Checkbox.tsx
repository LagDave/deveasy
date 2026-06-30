import { motion } from "framer-motion";

/**
 * A small animated checkbox: the box fills with the accent and the checkmark
 * draws itself in on check. Accessible (role=checkbox + aria-checked). Controlled
 * — the parent owns the boolean.
 */
interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
}

export function Checkbox({ checked, onChange, disabled, title, "aria-label": ariaLabel }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors duration-150 ${
        checked
          ? "border-accent bg-accent"
          : "border-line-strong bg-surface-2 hover:border-muted"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <motion.svg viewBox="0 0 18 18" className="h-3.5 w-3.5" aria-hidden="true">
        <motion.path
          d="M4 9.5 L7.5 13 L14 5"
          fill="none"
          stroke="#1a1205"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        />
      </motion.svg>
    </button>
  );
}
