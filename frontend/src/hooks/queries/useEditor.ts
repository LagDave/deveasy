import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDirListing,
  getEditorState,
  getFileContent,
  saveEditorState,
  saveFileContent,
} from "../../api/editor";
import type { EditorState } from "../../types";

/**
 * Data-fetching lives in hooks, not in component bodies (Constitution §14.3, §15.1).
 * Query keys are defined locally to this slice (shared queryClient.ts is untouched).
 */
const EDITOR_KEYS = {
  tree: (projectId: number | null, path: string) =>
    ["editor", "tree", projectId, path] as const,
  file: (projectId: number | null, path: string | null) =>
    ["editor", "file", projectId, path] as const,
  state: (projectId: number | null) => ["editor", "state", projectId] as const,
};

export function useDirListing(projectId: number | null, path: string) {
  return useQuery({
    queryKey: EDITOR_KEYS.tree(projectId, path),
    queryFn: () => getDirListing(projectId as number, path),
    enabled: Boolean(projectId),
  });
}

export function useFileContent(projectId: number | null, path: string | null) {
  return useQuery({
    queryKey: EDITOR_KEYS.file(projectId, path),
    queryFn: () => getFileContent(projectId as number, path as string),
    enabled: Boolean(projectId) && Boolean(path),
  });
}

export function useSaveFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { projectId: number; path: string; content: string }) =>
      saveFileContent(vars.projectId, vars.path, vars.content),
    onSuccess: (_res, vars) => {
      // The editor owns the buffer; only refresh the persisted file-content cache.
      void qc.invalidateQueries({
        queryKey: EDITOR_KEYS.file(vars.projectId, vars.path),
      });
    },
  });
}

export function useEditorState(projectId: number | null) {
  return useQuery({
    queryKey: EDITOR_KEYS.state(projectId),
    queryFn: () => getEditorState(projectId as number),
    enabled: Boolean(projectId),
  });
}

export function useSaveEditorState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { projectId: number; state: EditorState }) =>
      saveEditorState(vars.projectId, vars.state),
    onSuccess: (saved, vars) => {
      qc.setQueryData(EDITOR_KEYS.state(vars.projectId), saved);
    },
  });
}
