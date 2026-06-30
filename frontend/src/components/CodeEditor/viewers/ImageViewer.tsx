import { rawFileUrl } from "../../../api/editor";
import { basename } from "../editorPaths";

/** Read-only image viewer: the raw bytes endpoint as <img>, centered on a neutral checkerboard. */
interface Props {
  projectId: number;
  path: string;
}

const CHECKERBOARD =
  "repeating-conic-gradient(var(--color-surface-2) 0% 25%, var(--color-surface) 0% 50%) 0 0 / 24px 24px";

export function ImageViewer({ projectId, path }: Props) {
  return (
    <div className="grid h-full w-full place-items-center overflow-auto p-6" style={{ background: CHECKERBOARD }}>
      <img
        src={rawFileUrl(projectId, path)}
        alt={basename(path)}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}
