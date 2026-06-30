import { useState } from "react";
import { ApiError } from "../../../api";
import type { GitStatus } from "../../../api/git";
import {
  useCheckoutBranch,
  useCreateBranch,
  useGitBranches,
  useMergeToMain,
  usePush,
} from "../../../hooks/queries/useGit";
import { toast } from "../../../lib/toast";
import { useConfirm } from "../../ui/confirm";
import { Icon } from "../../ui/Icon";
import { SearchSelect } from "../../ui/SearchSelect";

const MAIN_BRANCH = "main";

interface Props {
  projectId: number;
  status: GitStatus | undefined;
}

/**
 * Branch switch / create + push + merge-to-main. Push and merge are destructive
 * remote operations, so each is gated behind a confirm dialog (§ spec risk).
 * Errors surface through the shared toast (§16.3).
 */
export function BranchToolbar({ projectId, status }: Props) {
  const confirm = useConfirm();
  const { data: branches } = useGitBranches(projectId, true);
  const checkout = useCheckoutBranch(projectId);
  const createBranch = useCreateBranch(projectId);
  const push = usePush(projectId);
  const merge = useMergeToMain(projectId);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const onError = (e: unknown, fallback: string) =>
    toast.error(e instanceof ApiError ? e.message : fallback);

  const current = status?.branch ?? "";
  const busy = checkout.isPending || push.isPending || merge.isPending;

  const doCheckout = (branch: string) => {
    if (!branch || branch === current) return;
    checkout.mutate(branch, { onError: (e) => onError(e, "Could not switch branch") });
  };

  const doCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createBranch.mutate(name, {
      onSuccess: () => {
        setNewName("");
        setCreating(false);
        toast.success(`Created ${name}`);
      },
      onError: (e) => onError(e, "Could not create branch"),
    });
  };

  const doPush = async () => {
    const ok = await confirm({
      title: "Push to remote?",
      message: `Push ${current || "this branch"} to its remote.`,
      confirmLabel: "Push",
    });
    if (!ok) return;
    push.mutate(undefined, {
      onSuccess: () => toast.success("Pushed"),
      onError: (e) => onError(e, "Push failed"),
    });
  };

  const doMerge = async () => {
    const ok = await confirm({
      title: "Merge to main?",
      message: `Merge ${current || "this branch"} into ${MAIN_BRANCH} and push. This updates ${MAIN_BRANCH} directly.`,
      confirmLabel: "Merge to main",
      danger: true,
    });
    if (!ok) return;
    merge.mutate(undefined, {
      onSuccess: () => toast.success(`Merged into ${MAIN_BRANCH}`),
      onError: (e) => onError(e, "Merge failed"),
    });
  };

  // The select must always list the current branch even if the lazy list is stale.
  const branchList = branches?.branches ?? [];
  const options = current && !branchList.includes(current) ? [current, ...branchList] : branchList;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
      <Icon name="branch" size={14} className="text-accent" />
      <SearchSelect
        className="w-56"
        value={current}
        options={options}
        onSelect={doCheckout}
        disabled={busy}
        icon="branch"
        placeholder="Select branch"
        searchPlaceholder="Search branches…"
        emptyLabel="No matching branches"
      />
      {status && status.ahead > 0 && <span className="pill">ahead {status.ahead}</span>}
      {status && status.behind > 0 && <span className="pill">behind {status.behind}</span>}

      {creating ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            className="field"
            placeholder="new-branch"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doCreate();
              if (e.key === "Escape") setCreating(false);
            }}
          />
          <button type="button" className="btn" onClick={doCreate} disabled={createBranch.isPending}>
            Create
          </button>
          <button type="button" className="btn" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" className="btn" onClick={() => setCreating(true)}>
          <Icon name="add" size={14} />
          Branch
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button type="button" className="btn" onClick={() => void doPush()} disabled={push.isPending}>
          <Icon name="commit" size={14} />
          {push.isPending ? "Pushing…" : "Push"}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void doMerge()}
          disabled={merge.isPending || current === MAIN_BRANCH}
        >
          <Icon name="branch" size={14} />
          {merge.isPending ? "Merging…" : "Merge to main"}
        </button>
      </div>
    </div>
  );
}
