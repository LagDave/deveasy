import { ApiError } from "../../api";
import type { AzureReviewerVote } from "../../api/azure";
import { useAzurePullRequestDetail } from "../../hooks/queries/useAzure";

interface Props {
  pullRequestId: number | null;
}

/** Map an Azure vote number to a readable label. */
function voteLabel(vote: AzureReviewerVote["vote"]): string {
  if (vote >= 10) return "Approved";
  if (vote === 5) return "Approved w/ suggestions";
  if (vote === -5) return "Waiting";
  if (vote <= -10) return "Rejected";
  return "No vote";
}

/** Full detail for a selected PR: status, reviewer votes, threads, changed files. */
export function PullRequestDetail({ pullRequestId }: Props) {
  const { data: pr, isLoading, error } = useAzurePullRequestDetail(pullRequestId);

  if (pullRequestId === null) {
    return <p className="muted">Select a pull request to see its detail.</p>;
  }
  if (isLoading) return <p className="muted">Loading detail…</p>;
  if (error) {
    return <p className="error">{error instanceof ApiError ? error.message : "Could not load PR detail"}</p>;
  }
  if (!pr) return null;

  return (
    <section className="cockpit-pr-detail">
      <h3>
        #{pr.pullRequestId} {pr.title}{" "}
        <span className={`cockpit-badge cockpit-badge-${pr.status}`}>{pr.status}</span>
      </h3>
      <p className="muted">
        {pr.sourceRefName.replace("refs/heads/", "")} → {pr.targetRefName.replace("refs/heads/", "")}
        {pr.createdBy ? ` · by ${pr.createdBy}` : ""}
      </p>
      {pr.description && <p className="cockpit-pr-description">{pr.description}</p>}

      <h4>Reviewers</h4>
      {pr.reviewers.length === 0 ? (
        <p className="muted">No reviewers.</p>
      ) : (
        <ul className="cockpit-reviewers">
          {pr.reviewers.map((r) => (
            <li key={r.displayName}>
              {r.displayName} — <span className="muted">{voteLabel(r.vote)}</span>
            </li>
          ))}
        </ul>
      )}

      <h4>Changed files</h4>
      {pr.changedFiles.length === 0 ? (
        <p className="muted">No changed files reported.</p>
      ) : (
        <ul className="cockpit-changed-files">
          {pr.changedFiles.map((f) => (
            <li key={f.path}>
              <code>{f.changeType}</code> {f.path}
            </li>
          ))}
        </ul>
      )}

      <h4>Threads</h4>
      {pr.threads.length === 0 ? (
        <p className="muted">No comment threads.</p>
      ) : (
        <ul className="cockpit-threads">
          {pr.threads.map((th) => (
            <li key={th.id} className="cockpit-thread">
              {th.status && <span className="muted">[{th.status}] </span>}
              {th.comments.map((c) => (
                <div key={c.id} className="cockpit-comment">
                  <strong>{c.author}</strong>
                  <span>{c.content}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
