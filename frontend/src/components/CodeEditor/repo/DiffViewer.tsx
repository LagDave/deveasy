import { DiffEditor } from "@monaco-editor/react";
import { useFileContent, useHeadContent } from "../../../hooks/queries/useEditor";
import { ensureMonacoSetup } from "../../../lib/monaco";
import { languageForPath } from "../editorLanguages";

/**
 * Side-by-side diff of a changed file: git HEAD (left) vs the working tree (right),
 * rendered with Monaco's DiffEditor. Handles the new-file case (no HEAD → empty
 * left) and the deleted-file case (working read fails → empty right). Read-only —
 * editing happens in the FILES tab (§14.1, §15.1).
 */
interface Props {
  projectId: number;
  path: string;
}

export function DiffViewer({ projectId, path }: Props) {
  ensureMonacoSetup();

  const { data: working, isLoading: workingLoading } = useFileContent(projectId, path);
  const { data: head, isLoading: headLoading } = useHeadContent(projectId, path);

  if (workingLoading || headLoading) {
    return <PaneMessage text="Loading diff…" />;
  }

  // working may be absent (deleted file); head.content is null for a new file.
  const original = head?.content ?? "";
  const modified = working?.content ?? "";

  return (
    <div className="h-full w-full">
      <DiffEditor
        height="100%"
        theme="vs-dark"
        original={original}
        modified={modified}
        language={languageForPath(path)}
        options={{
          readOnly: true,
          renderSideBySide: true,
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          minimap: { enabled: false },
          automaticLayout: true,
        }}
      />
    </div>
  );
}

function PaneMessage({ text }: { text: string }) {
  return (
    <div className="grid h-full w-full place-items-center p-6 text-center">
      <p className="text-sm text-faint">{text}</p>
    </div>
  );
}
