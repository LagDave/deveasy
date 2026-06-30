import { motion } from "framer-motion";
import { ApiError } from "../../api";
import { useAzurePullRequests } from "../../hooks/queries/useAzure";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import { Icon } from "../ui/Icon";
import { fadeUp, staggerContainer } from "../ui/motion";
import { prStatusPill, shortRef } from "./prStatus";

interface Props {
  enabled: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Called when a query surfaces a reconnect (401) error so the panel can prompt. */
  onReconnect: () => void;
}

/** Active pull requests with status pills; selecting one opens its detail. */
export function PullRequestList({ enabled, selectedId, onSelect, onReconnect }: Props) {
  const { data: pullRequests, isLoading, error } = useAzurePullRequests(enabled);

  if (error instanceof ApiError && error.code === "AZURE_RECONNECT_REQUIRED") {
    onReconnect();
  }

  return (
    <section className="surface flex flex-col px-5 py-4">
      <p className="eyebrow mb-3 flex items-center gap-2">
        <Icon name="pullRequest" size={14} className="text-accent" />
        Pull requests
      </p>

      {!enabled && (
        <EmptyState
          icon={<Icon name="error" size={26} />}
          title="Not connected"
          hint="Connect Azure above to see pull requests."
        />
      )}
      {enabled && isLoading && <Spinner label="Loading pull requests" />}
      {enabled && error && (
        <p className="text-sm text-danger">
          {error instanceof ApiError ? error.message : "Could not load PRs"}
        </p>
      )}
      {enabled && !isLoading && !error && pullRequests && pullRequests.length === 0 && (
        <EmptyState
          icon={<Icon name="pullRequest" size={26} />}
          title="No active pull requests"
          hint="New PRs will appear here."
        />
      )}
      {enabled && pullRequests && pullRequests.length > 0 && (
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="m-0 flex list-none flex-col gap-2 p-0"
        >
          {pullRequests.map((pr) => {
            const isActive = pr.pullRequestId === selectedId;
            return (
              <motion.li key={pr.pullRequestId} variants={fadeUp}>
                <button
                  type="button"
                  onClick={() => onSelect(pr.pullRequestId)}
                  className={`surface-2 card-hover flex w-full flex-col gap-1.5 px-4 py-3 text-left ${
                    isActive ? "!border-accent-line" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`pill ${prStatusPill(pr.status)}`}>{pr.status}</span>
                    <span className="font-mono text-xs text-faint">#{pr.pullRequestId}</span>
                  </div>
                  <span className="truncate font-medium text-ink">{pr.title}</span>
                  <span className="truncate font-mono text-xs text-faint">
                    {shortRef(pr.sourceRefName)} → {shortRef(pr.targetRefName)}
                    {pr.createdBy ? ` · ${pr.createdBy.displayName}` : ""}
                  </span>
                </button>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </section>
  );
}
