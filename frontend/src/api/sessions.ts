import { apiGet, apiPost } from "./index";

/**
 * Session REST domain (Constitution §12.1). Types are defined locally here rather
 * than in the shared types/ barrel to keep this slice self-contained. The live
 * transcript flows over WebSocket (see hooks/useSession); these endpoints cover
 * creation, listing, and the persisted history.
 */

export type SessionStatus = "active" | "closed";

export interface Session {
  id: number;
  project_id: number;
  title: string | null;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
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

export async function createSession(projectId: number, title?: string): Promise<Session> {
  const data = await apiPost<{ session: Session }>("/api/sessions", { projectId, title });
  return data.session;
}

export async function getSessions(projectId: number): Promise<Session[]> {
  const data = await apiGet<{ sessions: Session[] }>(`/api/sessions?projectId=${projectId}`);
  return data.sessions;
}

export async function getSessionMessages(sessionId: number): Promise<SessionMessage[]> {
  const data = await apiGet<{ messages: SessionMessage[] }>(`/api/sessions/${sessionId}/messages`);
  return data.messages;
}
