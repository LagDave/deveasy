import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSession,
  deleteSession,
  getAllSessions,
  getSessionMessages,
  getSessions,
  renameSession,
  stopSession,
  type Session,
  type SessionMessage,
} from "../../api/sessions";

/**
 * React Query hooks for session REST data (Constitution §14.3, §15.1). Query keys
 * are defined locally to keep this slice self-contained (no edit to the shared
 * lib/queryClient barrel).
 */
export const SESSION_QUERY_KEYS = {
  all: ["sessions", "all"] as const,
  list: (projectId: number) => ["sessions", "list", projectId] as const,
  messages: (sessionId: number) => ["sessions", "messages", sessionId] as const,
};

/** Live-polled so the running indicators refresh without a manual reload. */
export function useAllSessions() {
  return useQuery({
    queryKey: SESSION_QUERY_KEYS.all,
    queryFn: getAllSessions,
    refetchInterval: 4000,
  });
}

export function useSessions(projectId: number | null | undefined) {
  return useQuery({
    queryKey: SESSION_QUERY_KEYS.list(projectId ?? 0),
    queryFn: () => getSessions(projectId as number),
    enabled: Boolean(projectId),
  });
}

/** Persisted transcript for a session, loaded on mount (§14.3). */
export function useSessionHistory(sessionId: number | null | undefined) {
  return useQuery<SessionMessage[]>({
    queryKey: SESSION_QUERY_KEYS.messages(sessionId ?? 0),
    queryFn: () => getSessionMessages(sessionId as number),
    enabled: Boolean(sessionId),
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation<
    Session,
    Error,
    { projectId: number; title?: string; model?: string | null; effort?: string | null }
  >({
    mutationFn: ({ projectId, title, model, effort }) => createSession(projectId, title, model, effort),
    onSuccess: (session) => {
      void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEYS.list(session.project_id) });
      void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEYS.all });
    },
  });
}

export function useStopSession() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (sessionId) => stopSession(sessionId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEYS.all }),
  });
}

export function useRenameSession() {
  const qc = useQueryClient();
  return useMutation<void, Error, { sessionId: number; title: string }>({
    mutationFn: ({ sessionId, title }) => renameSession(sessionId, title),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEYS.all }),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (sessionId) => deleteSession(sessionId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEYS.all }),
  });
}
