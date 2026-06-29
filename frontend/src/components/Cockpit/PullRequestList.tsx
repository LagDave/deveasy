import { ApiError } from "../../api";
import { useAzurePullRequests } from "../../hooks/queries/useAzure";

interface Props {
  enabled: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Called when a query surfaces a reconnect (401) error so the panel can prompt. */
  onReconnect: () => void;
}

/** Active pull requests with status badges; selecting one opens its detail. */
export function PullRequestList({ enabled, selectedId, onSelect, onReconnect }: Props) {
  const { data: pullRequests, isLoading, error } = useAzurePullRequests(enabled);

  if (error instanceof ApiError && error.code === "AZURE_RECONNECT_REQUIRED") {
    onReconnect();
  }

  return (
    <section className="cockpit-pr-list">
      <h3>Pull requests</h3>
      {!enabled && <p className="muted">Connect Azure to see pull requests.</p>}
      {enabled && isLoading && <p className="muted">Loading pull requests…</p>}
      {enabled && error && (
        <p className="error">{error instanceof ApiError ? error.message : "Could not load PRs"}</p>
      )}
      {enabled && pullRequests && pullRequests.length === 0 && (
        <p className="muted">No active pull requests.</p>
      )}
      {enabled && pullRequests && pullRequests.length > 0 && (
        <ul className="cockpit-pr-items">
          {pullRequests.map((pr) => (
            <li
              key={pr.pullRequestId}
              className={pr.pullRequestId === selectedId ? "cockpit-pr active" : "cockpit-pr"}
            >
              <button type="button" onClick={() => onSelect(pr.pullRequestId)}>
                <span className={`cockpit-badge cockpit-badge-${pr.status}`}>{pr.status}</span>
                <span className="cockpit-pr-title">
                  #{pr.pullRequestId} {pr.title}
                </span>
                <span className="muted cockpit-pr-meta">
                  {pr.sourceRefName.replace("refs/heads/", "")} →{" "}
                  {pr.targetRefName.replace("refs/heads/", "")}
                  {pr.createdBy ? ` · ${pr.createdBy.displayName}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
