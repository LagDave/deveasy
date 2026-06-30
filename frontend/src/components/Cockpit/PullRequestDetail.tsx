import { ApiError } from "../../api";
import type { AzureReviewerVote } from "../../api/azure";
import { useAzurePullRequestDetail } from "../../hooks/queries/useAzure";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import { Icon } from "../ui/Icon";
import { prStatusPill, shortRef } from "./prStatus";

interface Props {
  projectId: number | null;
  pullRequestId: number | null;
}

/** Map an Azure vote number to a readable label + pill variant. */
function voteMeta(vote: AzureReviewerVote["vote"]): { label: string; pill: string } {
  if (vote >= 10) return { label: "Approved", pill: "pill-success" };
  if (vote === 5) return { label: "Approved w/ suggestions", pill: "pill-success" };
  if (vote === -5) return { label: "Waiting", pill: "pill-accent" };
  if (vote <= -10) return { label: "Rejected", pill: "pill-danger" };
  return { label: "No vote", pill: "pill" };
}

/** Full detail for a selected PR: status, reviewer votes, threads, changed files. */
export function PullRequestDetail({ projectId, pullRequestId }: Props) {
  const { data: pr, isLoading, error } = useAzurePullRequestDetail(projectId, pullRequestId);

  if (pullRequestId === null) {
    return (
      <section className="surface flex items-center justify-center px-6 py-5">
        <EmptyState
          icon={<Icon name="pullRequest" size={26} />}
          title="No pull request selected"
          hint="Pick a PR from the list to see its detail."
        />
      </section>
    );
  }
  if (isLoading) {
    return (
      <section className="surface px-6 py-5">
        <Spinner label="Loading detail" />
      </section>
    );
  }
  if (error) {
    const reconnect = error instanceof ApiError && error.code === "AZURE_RECONNECT_REQUIRED";
    return (
      <section className="surface px-6 py-5">
        {reconnect ? (
          <EmptyState
            icon={<Icon name="error" size={26} />}
            title="Azure connection expired"
            hint="Your PAT is no longer valid. Re-enter it in Azure connection above to reload this PR."
          />
        ) : (
          <p className="text-sm text-danger">
            {error instanceof ApiError ? error.message : "Could not load PR detail"}
          </p>
        )}
      </section>
    );
  }
  if (!pr) return null;

  return (
    <section className="surface flex flex-col gap-5 px-6 py-5">
      <header>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="font-mono text-xs text-faint">#{pr.pullRequestId}</span>
          <span className={`pill ${prStatusPill(pr.status)}`}>{pr.status}</span>
        </div>
        <h3 className="m-0 text-lg font-semibold tracking-tight text-ink">{pr.title}</h3>
        <p className="m-0 mt-1 font-mono text-xs text-faint">
          {shortRef(pr.sourceRefName)} → {shortRef(pr.targetRefName)}
          {pr.createdBy ? ` · by ${pr.createdBy}` : ""}
        </p>
        {pr.description && <p className="m-0 mt-3 text-sm text-muted">{pr.description}</p>}
      </header>

      <div>
        <p className="eyebrow mb-2 flex items-center gap-2">
          <Icon name="agent" size={14} className="text-accent" />
          Reviewers
        </p>
        {pr.reviewers.length === 0 ? (
          <p className="text-sm text-faint">No reviewers.</p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {pr.reviewers.map((r) => {
              const meta = voteMeta(r.vote);
              return (
                <li key={r.displayName} className={`pill ${meta.pill}`}>
                  {r.displayName} · {meta.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <p className="eyebrow mb-2 flex items-center gap-2">
          <Icon name="file" size={14} className="text-accent" />
          Changed files
        </p>
        {pr.changedFiles.length === 0 ? (
          <p className="text-sm text-faint">No changed files reported.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-xs">
            {pr.changedFiles.map((f) => (
              <li key={f.path} className="flex items-center gap-2 text-muted">
                <code className="rounded bg-surface-2 px-1.5 py-0.5 text-accent">{f.changeType}</code>
                <span className="truncate">{f.path}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="eyebrow mb-2 flex items-center gap-2">
          <Icon name="sessions" size={14} className="text-accent" />
          Threads
        </p>
        {pr.threads.length === 0 ? (
          <p className="text-sm text-faint">No comment threads.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {pr.threads.map((th) => (
              <li key={th.id} className="surface-2 px-4 py-3">
                {th.status && <span className="pill mb-2">{th.status}</span>}
                <div className="flex flex-col gap-2">
                  {th.comments.map((c) => (
                    <div key={c.id} className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs text-accent">{c.author}</span>
                      <span className="text-sm text-muted">{c.content}</span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
