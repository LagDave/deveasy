import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateTab,
  closeBrowser,
  closeTab,
  getBrowser,
  newTab,
  openBrowser,
} from "../../api/browser";

/**
 * React Query hooks for per-session browser REST data (Constitution §14.3, §15.1).
 * Query keys are defined locally to keep this slice self-contained (no edit to the
 * shared lib/queryClient barrel), matching useTerminals / useSessionHistory. Live
 * frames + tab updates arrive over WebSocket (useBrowserSocket); these cover the
 * initial status snapshot and the open/close/tab mutations.
 */
const BROWSER_KEYS = {
  status: (sessionId: number | null) => ["browser", sessionId] as const,
};

/** Browser status snapshot for a session; enabled only once the pane is mounted. */
export function useBrowserStatus(sessionId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: BROWSER_KEYS.status(sessionId),
    queryFn: () => getBrowser(sessionId as number),
    enabled: Boolean(sessionId) && enabled,
  });
}

/** Launch (or resume) the browser; refresh the status snapshot on success. */
export function useOpenBrowser(sessionId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => openBrowser(sessionId as number),
    onSuccess: () => void qc.invalidateQueries({ queryKey: BROWSER_KEYS.status(sessionId) }),
  });
}

/** Suspend the browser and free memory; refresh the status snapshot on success. */
export function useCloseBrowser(sessionId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => closeBrowser(sessionId as number),
    onSuccess: () => void qc.invalidateQueries({ queryKey: BROWSER_KEYS.status(sessionId) }),
  });
}

export function useNewTab(sessionId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => newTab(sessionId as number),
    onSuccess: () => void qc.invalidateQueries({ queryKey: BROWSER_KEYS.status(sessionId) }),
  });
}

export function useCloseTab(sessionId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tabId: string) => closeTab(sessionId as number, tabId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: BROWSER_KEYS.status(sessionId) }),
  });
}

export function useActivateTab(sessionId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tabId: string) => activateTab(sessionId as number, tabId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: BROWSER_KEYS.status(sessionId) }),
  });
}
