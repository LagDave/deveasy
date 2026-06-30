import { Icon } from "../ui/Icon";
import { basename } from "./editorPaths";

/**
 * The VS Code–style tab strip. Each tab shows the filename, a dirty dot when the
 * buffer has unsaved edits, and a close (×) button. Active tab is underlined with
 * the accent. The dirty-close confirmation lives in the container — `onClose`
 * here just notifies it.
 */
interface Props {
  tabs: string[];
  activePath: string | null;
  dirtyPaths: Set<string> | string[];
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function EditorTabs({ tabs, activePath, dirtyPaths, onSelect, onClose }: Props) {
  const isDirty = (path: string) =>
    dirtyPaths instanceof Set ? dirtyPaths.has(path) : dirtyPaths.includes(path);

  return (
    <div className="flex shrink-0 items-stretch overflow-x-auto border-b border-line bg-surface">
      {tabs.map((path) => {
        const active = path === activePath;
        const dirty = isDirty(path);
        return (
          <div
            key={path}
            className={`group flex shrink-0 items-center gap-2 border-r border-line px-3 py-2 text-xs transition-colors ${
              active
                ? "border-b-2 border-b-accent bg-surface-2 text-ink"
                : "text-muted hover:bg-surface-2/60 hover:text-ink"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(path)}
              className="flex items-center gap-1.5 font-mono"
              title={path}
            >
              {dirty && <span className="text-accent" aria-label="unsaved changes">●</span>}
              <span className="max-w-[12rem] truncate">{basename(path)}</span>
            </button>
            <button
              type="button"
              onClick={() => onClose(path)}
              className="grid h-4 w-4 place-items-center rounded text-faint opacity-0 transition-opacity hover:bg-surface-3 hover:text-ink group-hover:opacity-100"
              title="Close tab"
              aria-label={`Close ${basename(path)}`}
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
