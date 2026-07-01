import { apiDelete, apiGet, apiPost } from "./index";

/** Thin typed functions over the HTTP client — one file per backend domain (§12.1). */

export interface TerminalInfo {
  id: string;
  projectId: number;
  /** Owning session, or null for a plain project-only terminal (TERMINAL tab). */
  sessionId: number | null;
  createdAt: string;
}

export async function createTerminal(projectId: number): Promise<TerminalInfo> {
  return apiPost<TerminalInfo>("/api/terminal", { projectId });
}

export async function listTerminals(projectId: number): Promise<{ terminals: TerminalInfo[] }> {
  return apiGet<{ terminals: TerminalInfo[] }>(`/api/terminal?projectId=${projectId}`);
}

export async function killTerminal(id: string): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/api/terminal/${encodeURIComponent(id)}`);
}

/** Spawn a session terminal: a project terminal tagged with an owning session. */
export async function createSessionTerminal(
  projectId: number,
  sessionId: number,
): Promise<TerminalInfo> {
  return apiPost<TerminalInfo>("/api/terminal", { projectId, sessionId });
}

/** List the live terminals owned by a session (shown in the session pane strip). */
export async function listSessionTerminals(
  sessionId: number,
): Promise<{ terminals: TerminalInfo[] }> {
  return apiGet<{ terminals: TerminalInfo[] }>(`/api/terminal?sessionId=${sessionId}`);
}

/** Close a terminal by id (shared with the project TERMINAL tab). */
export async function closeTerminal(id: string): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/api/terminal/${encodeURIComponent(id)}`);
}
