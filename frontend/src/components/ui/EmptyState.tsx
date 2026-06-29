import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp } from "./motion";

/** Consistent empty / placeholder state for every panel. */
export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="surface mx-auto mt-10 flex max-w-md flex-col items-center gap-3 px-8 py-12 text-center"
    >
      {icon && <div className="text-2xl text-accent">{icon}</div>}
      <h3 className="m-0 font-mono text-base font-semibold tracking-tight">{title}</h3>
      {hint && <p className="m-0 text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
