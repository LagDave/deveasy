import type { GitStatusFile } from "../../../api/git";
import type { ChangeKind } from "../../../types";
import { changeBadge, changeColorClass } from "../gitChanges";

/** Porcelain XY status → change kind (mirrors gitChanges.kindOf). */
function kindOfState(state: string): ChangeKind {
  if (state === "??" || state.includes("A")) return "added";
  if (state.includes("D")) return "deleted";
  return "modified";
}

/** A file is staged when its index (first) column carries a change. */
function isStaged(state: string): boolean {
  const x = state[0];
  return x !== " " && x !== "?";
}

/** Renames are reported "old -> new"; the working path is the new one. */
function workingPath(p: string): string {
  return p.includes(" -> ") ? p.split(" -> ")[1] : p;
}

interface Props {
  files: GitStatusFile[];
  activePath: string | null;
  busy: boolean;
  onSelect: (path: string) => void;
  onToggleStage: (path: string, staged: boolean) => void;
}

/** The changed-files rail: a stage checkbox + change badge per file; click selects the diff. */
export function ChangedFilesList({ files, activePath, busy, onSelect, onToggleStage }: Props) {
  if (files.length === 0) {
    return <div className="p-4 text-sm text-faint">No changes in the working tree.</div>;
  }
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {files.map((f) => {
        const p = workingPath(f.path);
        const kind = kindOfState(f.state);
        const staged = isStaged(f.state);
        const active = p === activePath;
        return (
          <li
            key={f.path}
            className={`flex items-center gap-2 border-b border-line px-3 py-2 text-xs ${
              active ? "bg-surface-2" : "hover:bg-surface-2/60"
            }`}
          >
            <input
              type="checkbox"
              checked={staged}
              disabled={busy}
              onChange={() => onToggleStage(p, staged)}
              title={staged ? "Unstage" : "Stage"}
              aria-label={staged ? `Unstage ${p}` : `Stage ${p}`}
            />
            <button
              type="button"
              onClick={() => onSelect(p)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left font-mono"
              title={p}
            >
              <code className={`shrink-0 rounded bg-surface-2 px-1.5 py-0.5 ${changeColorClass(kind)}`}>
                {changeBadge(kind) || "?"}
              </code>
              <span className={`truncate ${changeColorClass(kind)}`}>{p}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
