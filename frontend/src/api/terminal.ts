import { apiDelete, apiGet, apiPost } from "./index";

/** Thin typed functions over the HTTP client — one file per backend domain (§12.1). */

export interface TerminalInfo {
  id: string;
  projectId: number;
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
