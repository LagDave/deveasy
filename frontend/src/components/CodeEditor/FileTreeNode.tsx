import { useState } from "react";
import { useDirListing } from "../../hooks/queries/useEditor";
import type { FileTreeEntry } from "../../types";
import { Icon } from "../ui/Icon";
import { changeBadge, changeColorClass, type ChangeMap } from "./gitChanges";

/**
 * One row of the lazy file tree, recursive. A directory shows a chevron + folder
 * glyph and only fetches its children once expanded (no listing until then). A
 * file row opens it via `onOpenFile` and highlights when it is the active path.
 * Git-changed files are colored with an A/M/D badge; directories containing a
 * change get a dot, so changes are visible without expanding.
 */
interface Props {
  projectId: number;
  entry: FileTreeEntry;
  depth: number;
  activePath: string | null;
  changes: ChangeMap;
  onOpenFile: (path: string) => void;
}

const INDENT_PER_DEPTH_REM = 0.75;

export function FileTreeNode({ projectId, entry, depth, activePath, changes, onOpenFile }: Props) {
  const [expanded, setExpanded] = useState(false);
  const indent = { paddingLeft: `${0.5 + depth * INDENT_PER_DEPTH_REM}rem` };

  if (entry.type === "dir") {
    return (
      <DirNode
        projectId={projectId}
        entry={entry}
        depth={depth}
        activePath={activePath}
        changes={changes}
        onOpenFile={onOpenFile}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        indent={indent}
      />
    );
  }

  const active = entry.path === activePath;
  const change = changes.files.get(entry.path);
  const changeColor = changeColorClass(change);
  const nameColor = change ? changeColor : active ? "text-ink" : "text-muted";

  return (
    <button
      type="button"
      style={indent}
      onClick={() => onOpenFile(entry.path)}
      className={`my-px flex w-full items-center gap-2 rounded py-1.5 pr-2 text-left text-sm transition-colors ${
        active ? "bg-surface-2" : "hover:bg-surface/60"
      } ${change ? "" : "hover:text-ink"}`}
      title={entry.path}
    >
      <Icon name="file" size={14} className={`shrink-0 ${change ? changeColor : "text-faint"}`} />
      <span className={`truncate font-mono text-xs ${nameColor}`}>{entry.name}</span>
      {change && (
        <span className={`ml-auto shrink-0 font-mono text-[10px] font-bold ${changeColor}`} aria-hidden>
          {changeBadge(change)}
        </span>
      )}
    </button>
  );
}

/** Directory row + its lazily-loaded children. Split out to keep the parent lean (§13.2). */
function DirNode({
  projectId,
  entry,
  depth,
  activePath,
  changes,
  onOpenFile,
  expanded,
  onToggle,
  indent,
}: Props & { expanded: boolean; onToggle: () => void; indent: { paddingLeft: string } }) {
  // Lazy: only fetch this directory's listing once it has been expanded.
  const { data, isLoading, error } = useDirListing(expanded ? projectId : null, entry.path);
  const hasChanges = changes.dirs.has(entry.path);

  return (
    <div>
      <button
        type="button"
        style={indent}
        onClick={onToggle}
        className={`my-px flex w-full items-center gap-2 rounded py-1.5 pr-2 text-left text-sm transition-colors hover:bg-surface/60 hover:text-ink ${
          hasChanges ? "text-ink" : "text-muted"
        }`}
        title={entry.path}
      >
        <Icon name={expanded ? "chevronDown" : "chevronRight"} size={13} className="shrink-0 text-faint" />
        <Icon name={expanded ? "folderOpen" : "folder"} size={14} className="shrink-0 text-accent" />
        <span className="truncate font-mono text-xs">{entry.name}</span>
        {hasChanges && (
          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="contains changes" />
        )}
      </button>

      {expanded && (
        <div>
          {isLoading && (
            <p style={{ paddingLeft: `${1.25 + depth * INDENT_PER_DEPTH_REM}rem` }} className="py-1.5 text-xs text-faint">
              Loading…
            </p>
          )}
          {error && (
            <p style={{ paddingLeft: `${1.25 + depth * INDENT_PER_DEPTH_REM}rem` }} className="py-1.5 text-xs text-danger">
              {(error as Error).message}
            </p>
          )}
          {data?.map((child) => (
            <FileTreeNode
              key={child.path}
              projectId={projectId}
              entry={child}
              depth={depth + 1}
              activePath={activePath}
              changes={changes}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
