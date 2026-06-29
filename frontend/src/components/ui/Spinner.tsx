import { motion } from "framer-motion";

/** Three pulsing dots — used for loading and "Claude is thinking" states. */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-muted">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-accent"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
      {label && <span className="font-mono text-xs tracking-wide">{label}</span>}
    </div>
  );
}
