import { Icon, type IconName } from "../ui/Icon";

/** The four workspace tabs of the project takeover. */
export type WorkspaceTab = "files" | "repo" | "prs" | "terminal";

const TABS: { id: WorkspaceTab; label: string; icon: IconName }[] = [
  { id: "files", label: "Files", icon: "folder" },
  { id: "repo", label: "Repo", icon: "branch" },
  { id: "prs", label: "PRs", icon: "pullRequest" },
  { id: "terminal", label: "Terminal", icon: "terminal" },
];

interface Props {
  active: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
}

/**
 * Top-level tab strip for the project takeover (FILES · REPO · PRS · TERMINAL).
 * Mirrors the EditorTabs visual language (accent underline on the active tab);
 * this is pure presentation — the active-tab state lives in the shell (§15.2).
 */
export function WorkspaceTabs({ active, onSelect }: Props) {
  return (
    <div className="flex shrink-0 items-stretch border-b border-line bg-surface">
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`flex items-center gap-2 border-r border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              isActive
                ? "border-b-2 border-b-accent bg-surface-2 text-ink"
                : "text-muted hover:bg-surface-2/60 hover:text-ink"
            }`}
          >
            <Icon name={t.icon} size={14} className={isActive ? "text-accent" : ""} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
