import { useEffect, useState } from "react";
import { useAzureStatus } from "../../hooks/queries/useAzure";
import { useProjects } from "../../hooks/queries/useProjects";
import { AzureSettings } from "./AzureSettings";
import { CreatePullRequestForm } from "./CreatePullRequestForm";
import { GitPanel } from "./GitPanel";
import { PullRequestDetail } from "./PullRequestDetail";
import { PullRequestList } from "./PullRequestList";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";

/**
 * The mountable Azure / Git cockpit. The operator picks the project explicitly from a
 * selector at the top; the chosen projectId flows into every git/azure hook and the
 * PR-create/settings calls. A 401 (reconnect) from any Azure query forces the settings
 * form open (Constitution §16). Server state stays in React Query; only the selected
 * project id is local UI state (§15.1, §15.2).
 *
 * Full-height layout — a pinned toolbar over a single scrolling body, mirroring
 * SessionPanel so the panel owns its own overflow.
 */
export function CockpitPanel() {
  const { data: projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedPr, setSelectedPr] = useState<number | null>(null);
  const [reconnectPrompt, setReconnectPrompt] = useState(false);

  // Default to the first project once the list loads, and recover if it disappears.
  useEffect(() => {
    if (!projects || projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }
    setSelectedProjectId((current) =>
      current && projects.some((p) => p.id === current) ? current : projects[0].id,
    );
  }, [projects]);

  const { data: status } = useAzureStatus(selectedProjectId);
  const isConnected = status?.status === "connected";

  // Clear the manual reconnect prompt once the connection recovers.
  useEffect(() => {
    if (isConnected) setReconnectPrompt(false);
  }, [isConnected]);

  // A different project means a different PR list — drop the stale selection.
  useEffect(() => {
    setSelectedPr(null);
  }, [selectedProjectId]);

  const promptReconnect = () => setReconnectPrompt(true);

  const hasProjects = Boolean(projects && projects.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-6 py-3">
        <Icon name="cockpit" size={16} className="text-accent" />
        <span className="eyebrow">Cockpit</span>
        <span className="font-mono text-xs text-faint">Git &amp; pull requests</span>
        <span className={`ml-auto pill ${isConnected ? "pill-success" : "pill"}`}>
          <Icon name={isConnected ? "success" : "error"} size={12} />
          {status?.status ?? "loading"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          {hasProjects && (
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Project</span>
              <select
                className="field"
                value={selectedProjectId ?? ""}
                onChange={(e) => setSelectedProjectId(Number(e.target.value))}
              >
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {selectedProjectId === null ? (
            <EmptyState
              icon={<Icon name="cockpit" size={26} />}
              title={hasProjects ? "Select a project" : "No projects yet"}
              hint={
                hasProjects
                  ? "Pick a project above to inspect its git state and pull requests."
                  : "Add a project first, then come back to the cockpit."
              }
            />
          ) : (
            <>
              <GitPanel projectId={selectedProjectId} />

              <AzureSettings
                projectId={selectedProjectId}
                state={status}
                forceOpen={reconnectPrompt}
              />

              <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
                <PullRequestList
                  projectId={selectedProjectId}
                  enabled={!!isConnected}
                  selectedId={selectedPr}
                  onSelect={setSelectedPr}
                  onReconnect={promptReconnect}
                />
                <PullRequestDetail
                  projectId={selectedProjectId}
                  pullRequestId={selectedPr}
                />
              </div>

              <CreatePullRequestForm
                projectId={selectedProjectId}
                disabled={!isConnected}
                onReconnect={promptReconnect}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
