import { useDirListing } from "../../hooks/queries/useEditor";
import { FileTreeNode } from "./FileTreeNode";

/**
 * Body of the file-tree rail: fetches the root directory level and renders one
 * FileTreeNode per entry (each node lazily expands its own children). Scrollable.
 */
interface Props {
  projectId: number;
  activePath: string | null;
  onOpenFile: (path: string) => void;
}

export function FileTree({ projectId, activePath, onOpenFile }: Props) {
  const { data, isLoading, error } = useDirListing(projectId, "");

  return (
    <div className="flex-1 overflow-y-auto px-1 py-1">
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
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}
