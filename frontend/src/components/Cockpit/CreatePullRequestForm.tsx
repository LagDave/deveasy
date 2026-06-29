import { useState } from "react";
import { ApiError } from "../../api";
import { useCreateAzurePullRequest } from "../../hooks/queries/useAzure";
import { toast } from "../../lib/toast";

interface Props {
  disabled: boolean;
  onReconnect: () => void;
}

/** Create-PR form: source/target branch, title, description. Read+create only. */
export function CreatePullRequestForm({ disabled, onReconnect }: Props) {
  const create = useCreateAzurePullRequest();
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
    <section className="cockpit-create-pr">
      <h3>Create pull request</h3>
      <form onSubmit={onSubmit} className="cockpit-form">
        <label>
          Source branch
          <input
            value={sourceRefName}
            onChange={(e) => setSourceRefName(e.target.value)}
            placeholder="feature/my-branch"
            required
          />
        </label>
        <label>
          Target branch
          <input value={targetRefName} onChange={(e) => setTargetRefName(e.target.value)} required />
        </label>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <button type="submit" disabled={disabled || create.isPending}>
          {create.isPending ? "Creating…" : "Create PR"}
        </button>
      </form>
    </section>
  );
}
