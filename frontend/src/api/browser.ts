import { apiDelete, apiGet, apiPost } from "./index";

/**
 * Per-session browser REST domain (Constitution §12.1). Thin typed functions over
 * the one HTTP client; types are defined locally to keep this slice self-contained
 * (matching api/sessions.ts and api/terminal.ts). The live screencast + input flow
 * over WebSocket (see hooks/useBrowserSocket) — these endpoints cover open/close,
 * status, and tab management.
 */

/** Who is currently driving the browser: the agent, the human operator, or nobody. */
export type BrowserController = "agent" | "human" | null;

export interface TabInfo {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

export interface BrowserInfo {
  sessionId: number;
  createdAt: string;
  controller: BrowserController;
  tabs: TabInfo[];
}

/** Launch (or resume) the Chromium instance for a session. */
export async function openBrowser(sessionId: number): Promise<BrowserInfo> {
  return apiPost<BrowserInfo>(`/api/browser/${sessionId}`);
}

/** Current browser state for a session (tabs + controller). */
export async function getBrowser(sessionId: number): Promise<BrowserInfo> {
  return apiGet<BrowserInfo>(`/api/browser/${sessionId}`);
}

/** Suspend the browser and free its memory (screencast stops). */
export async function closeBrowser(sessionId: number): Promise<void> {
  await apiPost<{ sessionId: number }>(`/api/browser/${sessionId}/close`);
}

export async function listTabs(sessionId: number): Promise<{ tabs: TabInfo[] }> {
  return apiGet<{ tabs: TabInfo[] }>(`/api/browser/${sessionId}/tabs`);
}

export async function newTab(sessionId: number): Promise<TabInfo> {
  return apiPost<TabInfo>(`/api/browser/${sessionId}/tabs`);
}

export async function closeTab(sessionId: number, tabId: string): Promise<void> {
  await apiDelete<{ tabId: string }>(`/api/browser/${sessionId}/tabs/${encodeURIComponent(tabId)}`);
}

export async function activateTab(sessionId: number, tabId: string): Promise<void> {
  await apiPost<{ tabId: string }>(`/api/browser/${sessionId}/tabs/${encodeURIComponent(tabId)}/activate`);
}
