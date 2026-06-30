import { useState } from "react";
import { rawFileUrl } from "../../../api/editor";
import { Icon } from "../../ui/Icon";
import { EditorPane } from "../EditorPane";
import { basename } from "../editorPaths";

/**
 * HTML files toggle between editing the source (Monaco) and viewing the rendered
 * page. The page is rendered in a sandboxed <iframe src> pointed at the raw
 * endpoint — never dangerouslySetInnerHTML (§17.4). Defaults to Code.
 */
interface Props {
  projectId: number;
  path: string;
  onDirtyChange: (path: string, isDirty: boolean) => void;
}

type Mode = "code" | "page";

export function HtmlViewer({ projectId, path, onDirtyChange }: Props) {
  const [mode, setMode] = useState<Mode>("code");

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-line bg-surface px-2 py-1.5">
        <ToggleButton active={mode === "code"} icon="code" label="Code" onClick={() => setMode("code")} />
        <ToggleButton active={mode === "page"} icon="preview" label="Page" onClick={() => setMode("page")} />
      </div>
      <div className="min-h-0 flex-1">
        {mode === "code" ? (
          <EditorPane projectId={projectId} path={path} onDirtyChange={onDirtyChange} />
        ) : (
          <iframe
            src={rawFileUrl(projectId, path)}
            sandbox="allow-same-origin"
            title={basename(path)}
            className="h-full w-full border-0 bg-white"
          />
        )}
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: "code" | "preview";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn !px-2.5 !py-1 ${active ? "btn-primary" : "btn-ghost"}`}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
}
