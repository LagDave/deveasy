import { useEffect, useState } from "react";
import { ApiError } from "../../api";
import { useCommit, useGitStatus, useStagePaths, useUnstagePaths } from "../../hooks/queries/useGit";
import { toast } from "../../lib/toast";
import { Icon } from "../ui/Icon";
import { BranchToolbar } from "./repo/BranchToolbar";
import { ChangedFilesList } from "./repo/ChangedFilesList";
import { CommitBar } from "./repo/CommitBar";
import { DiffViewer } from "./repo/DiffViewer";

/** Renames are reported "old -> new"; the working path is the new one. */
function workingPath(p: string): string {
  return p.includes(" -> ") ? p.split(" -> ")[1] : p;
}

/**
 * The REPO tab: a GitHub-Desktop-style working view for the open project. Branch
 * toolbar on top; a changed-files rail + commit bar on the left; the selected
 * file's HEAD-vs-working diff on the right. Server state is React Query; only the
 * selected path is local UI state (§15.1, §15.2).
 */
interface Props {
  projectId: number;
}

export function RepoTab({ projectId }: Props) {
  const { data: status } = useGitStatus(projectId);
  const stage = useStagePaths(projectId);
  const unstage = useUnstagePaths(projectId);
  const commit = useCommit(projectId);
  const [selected, setSelected] = useState<string | null>(null);

  const files = status?.files ?? [];

  // Keep the selection valid as the working tree changes (file committed/reverted).
  useEffect(() => {
    if (selected && !files.some((f) => workingPath(f.path) === selected)) {
      setSelected(files.length ? workingPath(files[0].path) : null);
    }
  }, [files, selected]);

  const onError = (e: unknown, fallback: string) =>
    toast.error(e instanceof ApiError ? e.message : fallback);

  const toggleStage = (path: string, staged: boolean) => {
    const m = staged ? unstage : stage;
    m.mutate([path], { onError: (e) => onError(e, "Could not update staging") });
  };

  const stagedCount = files.filter((f) => f.state[0] !== " " && f.state[0] !== "?").length;
  const busy = stage.isPending || unstage.isPending;

  return (
    <div className="flex h-full flex-col">
      <BranchToolbar projectId={projectId} status={status} />
      <div className="flex min-h-0 flex-1">
        <div className="flex w-80 shrink-0 flex-col border-r border-line">
          <div className="flex-1 overflow-y-auto">
            <ChangedFilesList
              files={files}
              activePath={selected}
              busy={busy}
              onSelect={setSelected}
              onToggleStage={toggleStage}
            />
          </div>
          <CommitBar
            stagedCount={stagedCount}
            committing={commit.isPending}
            onCommit={(message) =>
              commit.mutate(message, {
                onSuccess: () => toast.success("Committed"),
                onError: (e) => onError(e, "Commit failed"),
              })
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          {selected ? (
            <DiffViewer key={selected} projectId={projectId} path={selected} />
          ) : (
            <EmptyDiff />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyDiff() {
  return (
    <div className="grid h-full w-full place-items-center text-center">
      <div className="flex flex-col items-center gap-2 text-faint">
        <Icon name="branch" size={32} />
        <p className="text-sm">Select a changed file to see its diff</p>
      </div>
    </div>
  );
}
