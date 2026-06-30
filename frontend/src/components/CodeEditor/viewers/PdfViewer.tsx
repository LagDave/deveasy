import { rawFileUrl } from "../../../api/editor";
import { basename } from "../editorPaths";

/** Read-only PDF viewer: the browser renders the raw endpoint natively in an iframe. */
interface Props {
  projectId: number;
  path: string;
}

export function PdfViewer({ projectId, path }: Props) {
  return (
    <iframe
      src={rawFileUrl(projectId, path)}
      title={basename(path)}
      className="h-full w-full border-0"
    />
  );
}
