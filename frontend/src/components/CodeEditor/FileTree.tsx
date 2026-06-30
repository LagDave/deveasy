import { useDirListing } from "../../hooks/queries/useEditor";
import type { ChangeMap } from "./gitChanges";
import { FileTreeNode } from "./FileTreeNode";

/**
 * Body of the file-tree rail: fetches the root directory level and renders one
 * FileTreeNode per entry (each node lazily expands its own children). Scrollable.
 * `changes` drives the git-change highlighting passed down to every node.
 */
interface Props {
  projectId: number;
  activePath: string | null;
  changes: ChangeMap;
  onOpenFile: (path: string) => void;
}

export function FileTree({ projectId, activePath, changes, onOpenFile }: Props) {
  const { data, isLoading, error } = useDirListing(projectId, "");

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {isLoading && <p className="px-2 py-2 text-xs text-faint">Loading files…</p>}
      {error && <p className="px-2 py-2 text-xs text-danger">{(error as Error).message}</p>}
      {data?.length === 0 && <p className="px-2 py-2 text-xs text-faint">Empty directory</p>}
      {data?.map((entry) => (
        <FileTreeNode
          key={entry.path}
          projectId={projectId}
          entry={entry}
          depth={0}
          activePath={activePath}
          changes={changes}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}
