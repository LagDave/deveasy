import { apiGet, apiPost, apiPut } from "./index";
import type { EditorState, FileContent, FileTreeEntry } from "../types";

/** Thin typed functions over the HTTP client — one file per backend domain (§12.1). */

/** One directory level for the lazy file tree. */
export async function getDirListing(
  projectId: number,
  path: string,
): Promise<FileTreeEntry[]> {
  return apiGet<FileTreeEntry[]>(
    `/api/editor/tree?projectId=${projectId}&path=${encodeURIComponent(path)}`,
  );
}

/** Text file contents (the editor opens text only; binary/oversized rejected server-side). */
export async function getFileContent(
  projectId: number,
  path: string,
): Promise<FileContent> {
  return apiGet<FileContent>(
    `/api/editor/file?projectId=${projectId}&path=${encodeURIComponent(path)}`,
  );
}

export async function saveFileContent(
  projectId: number,
  path: string,
  content: string,
): Promise<{ path: string; savedAt: string }> {
  return apiPost<{ path: string; savedAt: string }>(`/api/editor/file`, {
    projectId,
    path,
    content,
  });
}

export async function getEditorState(projectId: number): Promise<EditorState> {
  return apiGet<EditorState>(`/api/editor/state?projectId=${projectId}`);
}

export async function saveEditorState(
  projectId: number,
  state: EditorState,
): Promise<EditorState> {
  return apiPut<EditorState>(`/api/editor/state`, {
    projectId,
    openPaths: state.openPaths,
    activePath: state.activePath,
  });
}

/**
 * Absolute-within-origin URL for the raw bytes endpoint, for use as the `src` of
 * <img>/<iframe>/<embed>. Requests in this app are same-origin/relative (the api
 * client calls `/api/...` with no base; the Vite dev server proxies `/api`), so
 * a relative URL is correct — it resolves against the current origin in both dev
 * and the built app.
 */
export function rawFileUrl(projectId: number, path: string): string {
  return `/api/editor/raw?projectId=${projectId}&path=${encodeURIComponent(path)}`;
}
