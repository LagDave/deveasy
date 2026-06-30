import { useState } from "react";
import { ApiError } from "../../api";
import { useCreateAzurePullRequest } from "../../hooks/queries/useAzure";
import { toast } from "../../lib/toast";
import { Icon } from "../ui/Icon";

interface Props {
  projectId: number | null;
  disabled: boolean;
  onReconnect: () => void;
}

/** Create-PR form: source/target branch, title, description. Read+create only. */
export function CreatePullRequestForm({ projectId, disabled, onReconnect }: Props) {
  const create = useCreateAzurePullRequest(projectId);
  const [sourceRefName, setSourceRefName] = useState("");
  const [targetRefName, setTargetRefName] = useState("main");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { sourceRefName, targetRefName, title, description },
      {
        onSuccess: (pr) => {
          toast.success(`Opened PR #${pr.pullRequestId}`);
          setTitle("");
          setDescription("");
          setSourceRefName("");
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === "AZURE_RECONNECT_REQUIRED") {
            onReconnect();
          }
          toast.error(err instanceof ApiError ? err.message : "Could not create the PR");
        },
      },
    );
  };

  return (
    <section className="surface px-6 py-5">
      <p className="eyebrow mb-4 flex items-center gap-2">
        <Icon name="pullRequest" size={14} className="text-accent" />
        Create pull request
      </p>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Source branch</span>
          <input
            className="field font-mono text-xs"
            value={sourceRefName}
            onChange={(e) => setSourceRefName(e.target.value)}
            placeholder="feature/my-branch"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Target branch</span>
          <input
            className="field font-mono text-xs"
            value={targetRefName}
            onChange={(e) => setTargetRefName(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Title</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Description</span>
          <textarea
            className="field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={disabled || create.isPending}>
            <Icon name="add" size={15} />
            {create.isPending ? "Creating…" : "Create PR"}
          </button>
        </div>
      </form>
    </section>
  );
}
