import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTerminal, killTerminal, listTerminals } from "../../api/terminal";

/** Data-fetching lives in hooks, not in component bodies (§14.3, §15.1). */

const TERMINAL_KEYS = {
  list: (projectId: number | null) => ["terminals", projectId] as const,
};

/** Live terminals for a project — the source for reattach on reload. */
export function useTerminals(projectId: number | null) {
  return useQuery({
    queryKey: TERMINAL_KEYS.list(projectId),
    queryFn: () => listTerminals(projectId as number),
    enabled: Boolean(projectId),
  });
}

/** Spawn a new terminal; refresh the list on success. */
export function useCreateTerminal(projectId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => createTerminal(projectId as number),
    onSuccess: () => void qc.invalidateQueries({ queryKey: TERMINAL_KEYS.list(projectId) }),
  });
}

/** Kill a terminal; refresh the list on success. */
export function useKillTerminal(projectId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => killTerminal(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: TERMINAL_KEYS.list(projectId) }),
  });
}
