import { useEffect, useState } from "react";
import { useAzureStatus } from "../../hooks/queries/useAzure";
import { AzureSettings } from "../Cockpit/AzureSettings";
import { CreatePullRequestForm } from "../Cockpit/CreatePullRequestForm";
import { PullRequestDetail } from "../Cockpit/PullRequestDetail";
import { PullRequestList } from "../Cockpit/PullRequestList";
import { Icon } from "../ui/Icon";

/**
 * The PRS tab: Azure connection + pull requests for the open project. Relocated
 * from the old CockpitPanel — the project is fixed (the takeover already chose
 * it), so there is no project selector. A 401 (reconnect) from any Azure query
 * forces the settings form open (§16). Server state stays in React Query; only
 * the selected PR id and the reconnect prompt are local UI state (§15.1, §15.2).
 */
interface Props {
  projectId: number;
}

export function PrsTab({ projectId }: Props) {
  const [selectedPr, setSelectedPr] = useState<number | null>(null);
  const [reconnectPrompt, setReconnectPrompt] = useState(false);

  const { data: status } = useAzureStatus(projectId);
  const isConnected = status?.status === "connected";

  // Clear the manual reconnect prompt once the connection recovers.
  useEffect(() => {
    if (isConnected) setReconnectPrompt(false);
  }, [isConnected]);

  const promptReconnect = () => setReconnectPrompt(true);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-6 py-3">
        <Icon name="pullRequest" size={16} className="text-accent" />
        <span className="eyebrow">Pull requests</span>
        <span className={`ml-auto pill ${isConnected ? "pill-success" : "pill"}`}>
          <Icon name={isConnected ? "success" : "error"} size={12} />
          {status?.status ?? "loading"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          <AzureSettings projectId={projectId} state={status} forceOpen={reconnectPrompt} />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <PullRequestList
              projectId={projectId}
              enabled={!!isConnected}
              selectedId={selectedPr}
              onSelect={setSelectedPr}
              onReconnect={promptReconnect}
            />
            <PullRequestDetail projectId={projectId} pullRequestId={selectedPr} />
          </div>

          <CreatePullRequestForm
            projectId={projectId}
            disabled={!isConnected}
            onReconnect={promptReconnect}
          />
        </div>
      </div>
    </div>
  );
}
