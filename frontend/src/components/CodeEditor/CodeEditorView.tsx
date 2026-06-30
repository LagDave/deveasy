import { useState } from "react";
import { Icon } from "../ui/Icon";
import { FilesTab } from "./FilesTab";
import { PrsTab } from "./PrsTab";
import { RepoTab } from "./RepoTab";
import { TerminalTab } from "./TerminalTab";
import { WorkspaceTabs, type WorkspaceTab } from "./WorkspaceTabs";

/**
 * The project takeover shell: a header (back to sessions + project name), a
 * workspace tab strip (FILES · REPO · PRS · TERMINAL), and the active tab's body.
 *
 * FILES stays mounted (hidden when inactive) so the open editors, dirty buffers,
 * and scroll position survive a tab switch — Monaco runs with automaticLayout, so
 * it re-measures correctly when shown again. The other tabs mount on demand.
 */
interface Props {
  projectId: number;
  projectName: string;
  onBack: () => void;
}

export function CodeEditorView({ projectId, projectName, onBack }: Props) {
  const [tab, setTab] = useState<WorkspaceTab>("files");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-7 w-7 shrink-0 place-items-center rounded text-faint hover:bg-surface-2 hover:text-ink"
          title="Back to sessions"
        >
          <Icon name="arrowLeft" size={16} />
        </button>
        <span className="truncate font-mono text-xs font-semibold text-muted" title={projectName}>
          {projectName}
        </span>
      </div>

      <WorkspaceTabs active={tab} onSelect={setTab} />

      <div className="min-h-0 flex-1">
        <div className={tab === "files" ? "h-full" : "hidden"}>
          <FilesTab projectId={projectId} />
        </div>
        {tab === "repo" && <RepoTab projectId={projectId} />}
        {tab === "prs" && <PrsTab projectId={projectId} />}
        {tab === "terminal" && <TerminalTab projectId={projectId} />}
      </div>
    </div>
  );
}
