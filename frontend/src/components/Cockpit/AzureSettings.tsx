import { useState } from "react";
import { ApiError } from "../../api";
import type { AzureConnectionState } from "../../api/azure";
import { useConnectAzure } from "../../hooks/queries/useAzure";
import { toast } from "../../lib/toast";

interface Props {
  state: AzureConnectionState | undefined;
  /** When true (e.g. after a 401), the form is expanded to prompt a reconnect. */
  forceOpen?: boolean;
}

/** PAT + (org, project, repo) mapping form. The PAT is write-only — never read back. */
export function AzureSettings({ state, forceOpen }: Props) {
  const connect = useConnectAzure();
  const [organization, setOrganization] = useState(state?.organization ?? "");
  const [project, setProject] = useState(state?.project ?? "");
  const [repository, setRepository] = useState(state?.repository ?? "");
  const [pat, setPat] = useState("");

  const needsAttention = forceOpen || state?.status === "expired" || state?.status === "disconnected";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    connect.mutate(
      { organization, project, repository, pat },
      {
        onSuccess: (next) => {
          setPat("");
          toast.success(next.status === "connected" ? "Azure connected" : `Status: ${next.status}`);
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Could not save Azure connection"),
      },
    );
  };

  return (
    <section className="surface px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="eyebrow">Azure connection</p>
        <span
          className={`pill ${needsAttention ? "pill-danger" : state?.status === "connected" ? "pill-success" : ""}`}
        >
          {state?.status ?? "loading"}
        </span>
        {needsAttention && (
          <span className="text-xs text-muted">Enter your PAT to (re)connect.</span>
        )}
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Organization</span>
          <input
            className="field"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Project</span>
          <input className="field" value={project} onChange={(e) => setProject(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Repository</span>
          <input
            className="field"
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Personal Access Token</span>
          <input
            className="field"
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder="stored in your OS keychain"
            autoComplete="off"
            required
          />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={connect.isPending}>
            {connect.isPending ? "Saving…" : "Save connection"}
          </button>
        </div>
      </form>
    </section>
  );
}
