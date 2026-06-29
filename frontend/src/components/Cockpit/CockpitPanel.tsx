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
    <div className="cockpit">
      <GitPanel />

      <AzureSettings state={status} forceOpen={reconnectPrompt} />

      <div className="cockpit-pr-layout">
        <PullRequestList
          enabled={isConnected}
          selectedId={selectedPr}
          onSelect={setSelectedPr}
          onReconnect={promptReconnect}
        />
        <PullRequestDetail pullRequestId={selectedPr} />
      </div>

      <CreatePullRequestForm disabled={!isConnected} onReconnect={promptReconnect} />
    </div>
  );
}
