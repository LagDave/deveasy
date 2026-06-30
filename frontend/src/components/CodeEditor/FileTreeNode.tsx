import { useState } from "react";
import { useDirListing } from "../../hooks/queries/useEditor";
import type { FileTreeEntry } from "../../types";
import { Icon } from "../ui/Icon";

/**
 * One row of the lazy file tree, recursive. A directory shows a chevron + folder
 * glyph and only fetches its children once expanded (no listing until then). A
 * file row opens it via `onOpenFile` and highlights when it is the active path.
 */
interface Props {
  projectId: number;
  entry: FileTreeEntry;
  depth: number;
  activePath: string | null;
  onOpenFile: (path: string) => void;
}

const INDENT_PER_DEPTH_REM = 0.75;

export function FileTreeNode({ projectId, entry, depth, activePath, onOpenFile }: Props) {
  const [expanded, setExpanded] = useState(false);
  const indent = { paddingLeft: `${0.5 + depth * INDENT_PER_DEPTH_REM}rem` };

  if (entry.type === "dir") {
    return (
      <DirNode
        projectId={projectId}
        entry={entry}
        depth={depth}
        activePath={activePath}
        onOpenFile={onOpenFile}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        indent={indent}
      />
    );
  }

  const active = entry.path === activePath;
  return (
    <button
      type="button"
      style={indent}
      onClick={() => onOpenFile(entry.path)}
      className={`flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-sm transition-colors ${
        active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface/60 hover:text-ink"
      }`}
      title={entry.path}
    >
      <Icon name="file" size={14} className="shrink-0 text-faint" />
      <span className="truncate font-mono text-xs">{entry.name}</span>
    </button>
  );
}

/** Directory row + its lazily-loaded children. Split out to keep the parent lean (§13.2). */
function DirNode({
  projectId,
  entry,
  depth,
  activePath,
  onOpenFile,
  expanded,
  onToggle,
  indent,
}: Props & { expanded: boolean; onToggle: () => void; indent: { paddingLeft: string } }) {
  // Lazy: only fetch this directory's listing once it has been expanded.
  const { data, isLoading, error } = useDirListing(expanded ? projectId : null, entry.path);

  return (
    <div>
      <button
        type="button"
        style={indent}
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-sm text-muted transition-colors hover:bg-surface/60 hover:text-ink"
        title={entry.path}
      >
        <Icon name={expanded ? "chevronDown" : "chevronRight"} size={13} className="shrink-0 text-faint" />
        <Icon name={expanded ? "folderOpen" : "folder"} size={14} className="shrink-0 text-accent" />
        <span className="truncate font-mono text-xs">{entry.name}</span>
      </button>

      {expanded && (
        <div>
          {isLoading && (
            <p style={{ paddingLeft: `${1.25 + depth * INDENT_PER_DEPTH_REM}rem` }} className="py-1 text-xs text-faint">
              Loading…
            </p>
          )}
          {error && (
            <p style={{ paddingLeft: `${1.25 + depth * INDENT_PER_DEPTH_REM}rem` }} className="py-1 text-xs text-danger">
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
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
