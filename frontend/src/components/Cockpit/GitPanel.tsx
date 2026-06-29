import { motion } from "framer-motion";
import { ApiError } from "../../api";
import { useGitHistory, useGitStatus } from "../../hooks/queries/useGit";
import { Spinner } from "../ui/Spinner";
import { fadeUp, staggerContainer } from "../ui/motion";

const errorMessage = (err: unknown): string =>
  err instanceof ApiError ? err.message : "Could not read git state";

/** Local git state for the active project: branch, working-tree status, and history. */
export function GitPanel() {
  const { data: history, isLoading: historyLoading, error: historyError } = useGitHistory();
  const { data: status, isLoading: statusLoading, error: statusError } = useGitStatus();

  return (
    <section className="surface px-6 py-5">
      <p className="eyebrow mb-3">Git</p>

      <div className="mb-5">
        {statusLoading && <Spinner label="Reading status" />}
        {statusError && <p className="text-sm text-danger">{errorMessage(statusError)}</p>}
        {status && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill pill-accent">{status.branch}</span>
              {status.ahead > 0 && <span className="pill">↑{status.ahead}</span>}
              {status.behind > 0 && <span className="pill">↓{status.behind}</span>}
              <span className={`pill ${status.isClean ? "pill-success" : ""}`}>
                {status.isClean ? "clean" : `${status.files.length} changed`}
              </span>
            </div>
            {!status.isClean && (
              <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0 font-mono text-xs">
                {status.files.map((f) => (
                  <li key={f.path} className="flex items-center gap-2 text-muted">
                    <code className="rounded bg-surface-2 px-1.5 py-0.5 text-accent">
                      {f.state.trim() || "??"}
                    </code>
                    <span className="truncate">{f.path}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div>
        <p className="eyebrow mb-2">History</p>
        {historyLoading && <Spinner label="Loading history" />}
        {historyError && <p className="text-sm text-danger">{errorMessage(historyError)}</p>}
        {history && history.commits.length === 0 && (
          <p className="text-sm text-faint">No commits yet.</p>
        )}
        {history && history.commits.length > 0 && (
          <motion.ul
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="m-0 flex list-none flex-col gap-1 p-0"
          >
            {history.commits.map((c) => (
              <motion.li
                key={c.hash}
                variants={fadeUp}
                className="surface-2 flex items-center gap-3 px-3 py-2 font-mono text-xs"
              >
                <code className="text-accent">{c.hash.slice(0, 8)}</code>
                <span className="min-w-0 flex-1 truncate text-ink">{c.subject}</span>
                <span className="shrink-0 text-faint">
                  {c.author} · {c.date.slice(0, 10)}
                </span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </section>
  );
}
