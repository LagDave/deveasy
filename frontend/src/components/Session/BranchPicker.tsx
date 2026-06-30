import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ApiError } from "../../api";
import { useCheckoutBranch, useGitBranches } from "../../hooks/queries/useGit";
import { toast } from "../../lib/toast";
import { Icon } from "../ui/Icon";

const COLLAPSED_LIMIT = 4;

/**
 * The branch line under a project: a compact dropdown to search and switch
 * branches. Collapsed it shows at most 4 (recent-first); a search reveals the
 * rest. Selecting a branch checks it out.
 */
export function BranchPicker({ projectId, current }: { projectId: number; current: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data, isLoading } = useGitBranches(projectId, open);
  const checkout = useCheckoutBranch(projectId);

  const all = data?.branches ?? [current];
  const filtered = query ? all.filter((b) => b.toLowerCase().includes(query.toLowerCase())) : all;
  const shown = query ? filtered : filtered.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = query ? 0 : Math.max(0, filtered.length - COLLAPSED_LIMIT);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const pick = (branch: string) => {
    if (branch !== current) {
      checkout.mutate(branch, {
        onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not switch branch"),
      });
    }
    close();
  };

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={current}
        className="flex min-w-0 max-w-full items-center gap-1 text-faint hover:text-muted"
      >
        <Icon name="branch" size={11} className="shrink-0" />
        <span className="truncate font-mono">{checkout.isPending ? "switching…" : current}</span>
        <Icon name="chevronDown" size={10} className="shrink-0" />
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
              className="surface absolute left-0 top-full z-30 mt-1 w-56 p-1.5"
            >
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search branches…"
                className="field mb-1 !py-1.5 text-xs"
              />
              <div className="max-h-56 overflow-y-auto">
                {isLoading && <p className="px-2 py-1.5 text-xs text-faint">Loading…</p>}
                {!isLoading && shown.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-faint">No matching branches</p>
                )}
                {shown.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => pick(b)}
                    disabled={checkout.isPending}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-surface-2 ${
                      b === current ? "text-accent" : "text-muted"
                    }`}
                  >
                    <Icon name="branch" size={11} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-mono">{b}</span>
                    {b === current && <span className="text-[9px] uppercase tracking-wide">current</span>}
                  </button>
                ))}
              </div>
              {hiddenCount > 0 && (
                <p className="px-2 pt-1 text-[10px] text-faint">+{hiddenCount} more — search to see all</p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
