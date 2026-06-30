import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorState, useSaveEditorState } from "../../hooks/queries/useEditor";
import { useGitStatus } from "../../hooks/queries/useGit";
import { Icon } from "../ui/Icon";
import { useConfirm } from "../ui/confirm";
import { EditorPane } from "./EditorPane";
import { EditorTabs } from "./EditorTabs";
import { FileTree } from "./FileTree";
import { buildChangeMap } from "./gitChanges";
import { kindForPath } from "./editorLanguages";
import { ImageViewer } from "./viewers/ImageViewer";
import { PdfViewer } from "./viewers/PdfViewer";
import { HtmlViewer } from "./viewers/HtmlViewer";

/**
 * The editor takeover: a file-tree rail (back to sessions + project name) and a
 * tabbed viewer area. Owns the open-tabs / active-tab / dirty state, hydrates it
 * once from the persisted editor state, and writes it back when the user changes
 * tabs. Picks the viewer per file kind (§14.1, §15.1).
 */
interface Props {
  projectId: number;
  projectName: string;
  onBack: () => void;
}

export function CodeEditorView({ projectId, projectName, onBack }: Props) {
  const confirm = useConfirm();
  const { data: persisted } = useEditorState(projectId);
  const saveState = useSaveEditorState();
  const { data: gitStatus } = useGitStatus(projectId);
  const changes = useMemo(() => buildChangeMap(gitStatus?.files), [gitStatus]);

  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set());

  // Hydrate open tabs from persisted state exactly once.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !persisted) return;
    hydratedRef.current = true;
    setOpenPaths(persisted.openPaths ?? []);
    setActivePath(persisted.activePath ?? null);
  }, [persisted]);

  // Persist tab changes — but skip the initial hydrate render.
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveState.mutate({ projectId, state: { openPaths, activePath } });
    // saveState is a stable mutation object; openPaths/activePath drive persistence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPaths, activePath, projectId]);

  const openFile = useCallback((path: string) => {
    setOpenPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActivePath(path);
  }, []);

  const onDirtyChange = useCallback((path: string, isDirty: boolean) => {
    setDirtyPaths((prev) => {
      const has = prev.has(path);
      if (isDirty === has) return prev;
      const next = new Set(prev);
      if (isDirty) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  const closeTab = useCallback(
    async (path: string) => {
      if (dirtyPaths.has(path)) {
        const ok = await confirm({
          title: "Discard unsaved changes?",
          message: `"${path}" has unsaved edits that will be lost.`,
          confirmLabel: "Discard",
          danger: true,
        });
        if (!ok) return;
      }
      setDirtyPaths((prev) => {
        if (!prev.has(path)) return prev;
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      setOpenPaths((prev) => {
        const idx = prev.indexOf(path);
        const next = prev.filter((p) => p !== path);
        setActivePath((cur) => {
          if (cur !== path) return cur;
          if (next.length === 0) return null;
          return next[Math.min(idx, next.length - 1)];
        });
        return next;
      });
    },
    [dirtyPaths, confirm],
  );

  return (
    <div className="flex h-full">
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-line">
        <div className="border-b border-line px-3 py-3">
          <div className="flex items-center gap-2">
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
          <p className="eyebrow mt-2">Files</p>
        </div>
        <FileTree projectId={projectId} activePath={activePath} changes={changes} onOpenFile={openFile} />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <EditorTabs
          tabs={openPaths}
          activePath={activePath}
          dirtyPaths={dirtyPaths}
          changedFiles={changes.files}
          onSelect={setActivePath}
          onClose={(p) => void closeTab(p)}
        />
        <div className="min-h-0 flex-1">
          {activePath ? (
            <ActiveViewer projectId={projectId} path={activePath} onDirtyChange={onDirtyChange} />
          ) : (
            <EmptyState />
          )}
        </div>
      </section>
    </div>
  );
}

/** Pick the viewer for the active file by kind (text → Monaco; image/pdf/html → viewers). */
function ActiveViewer({
  projectId,
  path,
  onDirtyChange,
}: {
  projectId: number;
  path: string;
  onDirtyChange: (path: string, isDirty: boolean) => void;
}) {
  const kind = kindForPath(path);
  // `key` per path so each tab keeps an isolated editor/viewer instance.
  if (kind === "image") return <ImageViewer key={path} projectId={projectId} path={path} />;
  if (kind === "pdf") return <PdfViewer key={path} projectId={projectId} path={path} />;
  if (kind === "html")
    return <HtmlViewer key={path} projectId={projectId} path={path} onDirtyChange={onDirtyChange} />;
  return <EditorPane key={path} projectId={projectId} path={path} onDirtyChange={onDirtyChange} />;
}

function EmptyState() {
  return (
    <div className="grid h-full w-full place-items-center text-center">
      <div className="flex flex-col items-center gap-2 text-faint">
        <Icon name="code" size={32} />
        <p className="text-sm">No file open</p>
      </div>
    </div>
  );
}
