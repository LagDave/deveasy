import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { closeTerminal, createSessionTerminal, listSessionTerminals } from "../../api/terminal";

/** Data-fetching lives in hooks, not in component bodies (§14.3, §15.1). */

const SESSION_TERMINAL_KEYS = {
  list: (sessionId: number | null) => ["session-terminals", sessionId] as const,
};

/** Live terminals owned by a session — the source for the session pane strip. */
export function useSessionTerminals(sessionId: number | null) {
  return useQuery({
    queryKey: SESSION_TERMINAL_KEYS.list(sessionId),
    queryFn: () => listSessionTerminals(sessionId as number),
    enabled: sessionId != null,
  });
}

/** Spawn a session terminal in the session's project; refresh the list on success. */
export function useCreateSessionTerminal(sessionId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: number) => createSessionTerminal(projectId, sessionId as number),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: SESSION_TERMINAL_KEYS.list(sessionId) }),
  });
}

/** Close a session terminal; refresh the list on success. */
export function useCloseSessionTerminal(sessionId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => closeTerminal(id),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: SESSION_TERMINAL_KEYS.list(sessionId) }),
  });
}
