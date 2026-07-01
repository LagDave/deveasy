import type { TabInfo } from "../../api/browser";
import { Icon } from "../ui/Icon";

interface Props {
  tabs: TabInfo[];
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onNew: () => void;
}

/**
 * Thin row of browser tab chips (title or url), active one highlighted, a "+" to
 * open a new tab and an "×" per tab. Pure presentation — mirrors the terminal /
 * WorkspaceTabs dark aesthetic (border-line, surface-2 active, font-mono url); the
 * tab state lives on the server and arrives via useBrowserSocket (§15.2).
 */
export function BrowserTabStrip({ tabs, onSelect, onClose, onNew }: Props) {
  return (
    <div className="flex items-stretch overflow-x-auto border-b border-line bg-surface">
      {tabs.map((tab) => {
        const label = tab.title || tab.url || "New Tab";
        return (
          <div
            key={tab.id}
            className={`group flex max-w-[220px] items-center gap-1.5 border-r border-line px-3 py-1.5 text-xs transition-colors ${
              tab.active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(tab.id)}
              title={tab.url || label}
              className="min-w-0 flex-1 truncate text-left font-mono"
            >
              {label}
            </button>
            <button
              type="button"
              onClick={() => onClose(tab.id)}
              title="Close tab"
              aria-label="Close tab"
              className="grid h-4 w-4 shrink-0 place-items-center rounded text-faint opacity-0 hover:bg-surface-3 hover:text-ink group-hover:opacity-100"
            >
              <Icon name="close" size={11} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onNew}
        title="New tab"
        aria-label="New tab"
        className="grid w-9 shrink-0 place-items-center text-faint hover:bg-surface-2/60 hover:text-ink"
      >
        <Icon name="add" size={14} />
      </button>
    </div>
  );
}
