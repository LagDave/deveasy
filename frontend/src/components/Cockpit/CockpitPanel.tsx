import { useEffect, useState } from "react";
import { useAzureStatus } from "../../hooks/queries/useAzure";
import { AzureSettings } from "./AzureSettings";
import { CreatePullRequestForm } from "./CreatePullRequestForm";
import { GitPanel } from "./GitPanel";
import { PullRequestDetail } from "./PullRequestDetail";
import { PullRequestList } from "./PullRequestList";

/**
 * The mountable Azure / Git cockpit for the active project. Composes the git panel,
 * the Azure PAT/mapping settings, the PR list + detail, and a create-PR form. A 401
 * (reconnect) from any Azure query forces the settings form open (Constitution §16).
 *
 * Full-height layout — a pinned toolbar over a single scrolling body, mirroring
 * SessionPanel so the panel owns its own overflow.
 */
export function CockpitPanel() {
  const { data: status } = useAzureStatus();
  const [selectedPr, setSelectedPr] = useState<number | null>(null);
  const [reconnectPrompt, setReconnectPrompt] = useState(false);

  const isConnected = status?.status === "connected";

  // Clear the manual reconnect prompt once the connection recovers.
  useEffect(() => {
    if (isConnected) setReconnectPrompt(false);
  }, [isConnected]);

  const promptReconnect = () => setReconnectPrompt(true);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-6 py-3">
        <span className="eyebrow">Cockpit</span>
        <span className="font-mono text-xs text-faint">Git &amp; pull requests</span>
        <span
          className={`ml-auto pill ${isConnected ? "pill-success" : "pill"}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {status?.status ?? "loading"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          <GitPanel />

          <AzureSettings state={status} forceOpen={reconnectPrompt} />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <PullRequestList
              enabled={!!isConnected}
              selectedId={selectedPr}
              onSelect={setSelectedPr}
              onReconnect={promptReconnect}
            />
            <PullRequestDetail pullRequestId={selectedPr} />
          </div>

          <CreatePullRequestForm disabled={!isConnected} onReconnect={promptReconnect} />
        </div>
      </div>
    </div>
  );
}
