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
    <section className="cockpit-azure-settings">
      <h3>Azure connection</h3>
      <p className={needsAttention ? "error" : "muted"}>
        Status: <strong>{state?.status ?? "loading…"}</strong>
        {needsAttention && " — enter your PAT to (re)connect."}
      </p>
      <form onSubmit={onSubmit} className="cockpit-form">
        <label>
          Organization
          <input value={organization} onChange={(e) => setOrganization(e.target.value)} required />
        </label>
        <label>
          Project
          <input value={project} onChange={(e) => setProject(e.target.value)} required />
        </label>
        <label>
          Repository
          <input value={repository} onChange={(e) => setRepository(e.target.value)} required />
        </label>
        <label>
          Personal Access Token
          <input
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder="stored in your OS keychain"
            autoComplete="off"
            required
          />
        </label>
        <button type="submit" disabled={connect.isPending}>
          {connect.isPending ? "Saving…" : "Save connection"}
        </button>
      </form>
    </section>
  );
}
