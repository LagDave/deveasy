import { apiDelete, apiGet, apiPatch, apiPost } from "./index";

/**
 * Session REST domain (Constitution §12.1). Types are defined locally here rather
 * than in the shared types/ barrel to keep this slice self-contained. The live
 * transcript flows over WebSocket (see hooks/useSession); these endpoints cover
 * creation, listing, and the persisted history.
 */

export type SessionStatus = "active" | "closed";

/** Runtime status of a live session: working = responding, idle = awaiting input. */
export type SessionRuntime = "working" | "idle" | null;

export interface Session {
  id: number;
  project_id: number;
  title: string | null;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  /** null when no live process; otherwise working or idle (running indicator). */
  runtime?: SessionRuntime;
}

export type SessionRole = "user" | "assistant" | "system";

export interface SessionMessage {
  id: number;
  session_id: number;
  role: SessionRole;
  event_type: string;
  content: unknown;
  created_at: string;
}

export async function createSession(
  projectId: number,
  title?: string,
  model?: string | null,
): Promise<Session> {
  const data = await apiPost<{ session: Session }>("/api/sessions", { projectId, title, model });
  return data.session;
}

export async function getSessions(projectId: number): Promise<Session[]> {
  const data = await apiGet<{ sessions: Session[] }>(`/api/sessions?projectId=${projectId}`);
  return data.sessions;
}

/** Every session across all projects (for the grouped sidebar). */
export async function getAllSessions(): Promise<Session[]> {
  const data = await apiGet<{ sessions: Session[] }>("/api/sessions");
  return data.sessions;
}

export async function getSessionMessages(sessionId: number): Promise<SessionMessage[]> {
  const data = await apiGet<{ messages: SessionMessage[] }>(`/api/sessions/${sessionId}/messages`);
  return data.messages;
}

/** Explicitly end a session's CLI process. */
export async function stopSession(sessionId: number): Promise<void> {
  await apiPost<{ sessionId: number }>(`/api/sessions/${sessionId}/stop`);
}

export async function renameSession(sessionId: number, title: string): Promise<void> {
  await apiPatch<{ sessionId: number }>(`/api/sessions/${sessionId}`, { title });
}

export async function deleteSession(sessionId: number): Promise<void> {
  await apiDelete<{ sessionId: number }>(`/api/sessions/${sessionId}`);
}
