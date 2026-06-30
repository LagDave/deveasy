import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useRef } from "react";
import { useFileContent, useHeadContent, useSaveFile } from "../../hooks/queries/useEditor";
import type { ApiError } from "../../api";
import { ensureMonacoSetup } from "../../lib/monaco";
import { toast } from "../../lib/toast";
import { languageForPath } from "./editorLanguages";
import { basename } from "./editorPaths";
import { diffToDecorations } from "./gitGutter";

type Monaco = typeof import("monaco-editor");

/**
 * Monaco text editor for one file. Loads content through the React Query hook,
 * tracks dirty state against the saved baseline, and wires Cmd/Ctrl+S to save
 * the current buffer back to disk. Loading/error states are surfaced inline.
 */
interface Props {
  projectId: number;
  path: string;
  onDirtyChange: (path: string, isDirty: boolean) => void;
}

export function EditorPane({ projectId, path, onDirtyChange }: Props) {
  ensureMonacoSetup();

  const { data, isLoading, error } = useFileContent(projectId, path);
  const { data: head } = useHeadContent(projectId, path);
  const saveMutation = useSaveFile();

  // The last-saved value; dirty = current editor value differs from this.
  const baselineRef = useRef<string>("");
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  // HEAD content for this path; the gutter diffs the live buffer against it.
  const headRef = useRef<string | null>(null);

  // Reset the baseline whenever fresh content loads for this path.
  useEffect(() => {
    if (data) {
      baselineRef.current = data.content;
      onDirtyChange(path, false);
    }
  }, [data, path, onDirtyChange]);

  // Repaint the diff gutter: HEAD vs the live editor buffer.
  const refreshGutter = useCallback(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const decos = diffToDecorations(headRef.current, ed.getValue(), monaco);
    if (!decorationsRef.current) decorationsRef.current = ed.createDecorationsCollection();
    decorationsRef.current.set(decos);
  }, []);

  // Recompute when HEAD arrives (or changes path).
  useEffect(() => {
    if (head === undefined) return;
    headRef.current = head?.content ?? null;
    refreshGutter();
  }, [head, refreshGutter]);

  const save = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const value = ed.getValue();
    saveMutation.mutate(
      { projectId, path, content: value },
      {
        onSuccess: () => {
          baselineRef.current = value;
          onDirtyChange(path, false);
          toast.success(`Saved ${basename(path)}`);
        },
        onError: (err) => toast.error((err as ApiError).message),
      },
    );
  }, [projectId, path, saveMutation, onDirtyChange]);

  // Keep `save` reachable from the Monaco command without re-registering it.
  const saveRef = useRef(save);
  saveRef.current = save;

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current());
    refreshGutter();
  };

  const handleChange = (value: string | undefined) => {
    onDirtyChange(path, (value ?? "") !== baselineRef.current);
    refreshGutter();
  };

  if (isLoading) return <PaneMessage text="Loading file…" />;
  if (error) return <PaneMessage text={(error as ApiError).message} danger />;

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        theme="vs-dark"
        path={path}
        language={languageForPath(path)}
        value={data?.content ?? ""}
        onMount={handleMount}
        onChange={handleChange}
        options={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          minimap: { enabled: false },
          automaticLayout: true,
          lineDecorationsWidth: 12,
        }}
      />
    </div>
  );
}

function PaneMessage({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <div className="grid h-full w-full place-items-center p-6 text-center">
      <p className={`text-sm ${danger ? "text-danger" : "text-faint"}`}>{text}</p>
    </div>
  );
}
