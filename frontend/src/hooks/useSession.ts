import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionMessage } from "../api/sessions";
import { getSessionMessages } from "../api/sessions";

/**
 * Owns the live WebSocket connection for a session (Constitution §14.3): connects,
 * sends user turns, and accumulates streamed stream-json events into state. The
 * persisted transcript is loaded once on mount and the live stream is appended.
 */

/** A Claude stream-json event — kept permissive so unknown types still render. */
export interface SessionEvent {
  type: string;
  [key: string]: unknown;
}

export type ConnectionStatus = "connecting" | "open" | "closed" | "error";

const WS_BASE_PATH = "/ws/sessions";

interface UseSessionResult {
  events: SessionEvent[];
  status: ConnectionStatus;
  send: (text: string) => void;
  isReady: boolean;
  /** True from the moment a turn is sent until the CLI emits its `result` event. */
  streaming: boolean;
}

/** Build the absolute ws:// URL from the current page origin (Vite proxies /ws). */
function buildWsUrl(sessionId: number): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${WS_BASE_PATH}?sessionId=${sessionId}`;
}

/** Map a persisted message row into a stream-event for uniform rendering. */
function historyToEvents(messages: SessionMessage[]): SessionEvent[] {
  return messages.map((m) => {
    if (m.content && typeof m.content === "object") {
      return m.content as SessionEvent;
    }
    return { type: m.event_type, role: m.role, content: m.content };
  });
}

export function useSession(sessionId: number | null): UseSessionResult {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [isReady, setIsReady] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  // Load persisted history once per session, then open the live stream.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    setEvents([]);
    setIsReady(false);
    setStreaming(false);
    setStatus("connecting");

    getSessionMessages(sessionId)
      .then((messages) => {
        if (!cancelled) setEvents(historyToEvents(messages));
      })
      .catch(() => {
        // History is best-effort; the live stream still works. Surfaced by the
        // React Query history hook in the panel if a hard error state is needed.
      });

    const ws = new WebSocket(buildWsUrl(sessionId));
    socketRef.current = ws;

    ws.onopen = () => setStatus("open");
    ws.onerror = () => setStatus("error");
    ws.onclose = () => {
      setStatus("closed");
      setIsReady(false);
      setStreaming(false);
    };
    ws.onmessage = (ev) => {
      let parsed: SessionEvent;
      try {
        parsed = JSON.parse(ev.data as string) as SessionEvent;
      } catch {
        return; // ignore unparseable frames rather than crash the UI
      }
      if (parsed.type === "ready") {
        setIsReady(true);
        // Reattaching to a session that's mid-turn should show "responding".
        setStreaming(parsed.state === "working");
        return;
      }
      if (parsed.type === "process_closed") {
        setStreaming(false);
      }
      // A `result` event ends the current turn.
      if (parsed.type === "result") setStreaming(false);
      setEvents((prev) => [...prev, parsed]);
    };

    return () => {
      cancelled = true;
      ws.close();
      socketRef.current = null;
    };
  }, [sessionId]);

  const send = useCallback((text: string) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "user_turn", text }));
    setStreaming(true);
    // Optimistically echo the user turn so it appears immediately.
    setEvents((prev) => [
      ...prev,
      { type: "user", message: { role: "user", content: [{ type: "text", text }] } },
    ]);
  }, []);

  return { events, status, send, isReady, streaming };
}
