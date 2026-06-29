import { ApiError } from "../../api";
import { useGitHistory, useGitStatus } from "../../hooks/queries/useGit";

/** Local git state for the active project: branch, working-tree status, and history. */
export function GitPanel() {
  const { data: history, isLoading: historyLoading, error: historyError } = useGitHistory();
  const { data: status, isLoading: statusLoading, error: statusError } = useGitStatus();

  const errorMessage = (err: unknown): string =>
    err instanceof ApiError ? err.message : "Could not read git state";

  return (
    <section className="cockpit-git">
      <h3>Git</h3>

      <div className="cockpit-git-status">
        {statusLoading && <p className="muted">Reading status…</p>}
        {statusError && <p className="error">{errorMessage(statusError)}</p>}
        {status && (
          <>
            <p>
              <strong>Branch:</strong> {status.branch}
              {status.ahead > 0 && <span className="muted"> ↑{status.ahead}</span>}
              {status.behind > 0 && <span className="muted"> ↓{status.behind}</span>}
            </p>
            {status.isClean ? (
              <p className="muted">Working tree clean</p>
            ) : (
              <ul className="cockpit-status-files">
                {status.files.map((f) => (
                  <li key={f.path}>
                    <code>{f.state.trim() || "??"}</code> {f.path}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="cockpit-git-history">
        <h4>History</h4>
        {historyLoading && <p className="muted">Loading history…</p>}
        {historyError && <p className="error">{errorMessage(historyError)}</p>}
        {history && history.commits.length === 0 && <p className="muted">No commits yet.</p>}
        {history && history.commits.length > 0 && (
          <ul className="cockpit-commit-list">
            {history.commits.map((c) => (
              <li key={c.hash} className="cockpit-commit">
                <code className="cockpit-commit-hash">{c.hash.slice(0, 8)}</code>
                <span className="cockpit-commit-subject">{c.subject}</span>
                <span className="muted cockpit-commit-meta">
                  {c.author} · {c.date.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
