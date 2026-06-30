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
  /** Live, not-yet-committed assistant text streaming in token-by-token. */
  partialText: string;
  /** Resolved model in use for this session (from the CLI init event); null until known. */
  model: string | null;
  /** Slash commands / skills available this session (autocomplete source). */
  slashCommands: string[];
  /** Context-window usage for the current session, or null until a result arrives. */
  context: { used: number; window: number } | null;
  /** Switch the session's model — restarts the CLI resumed, preserving context. */
  setModel: (model: string | null) => void;
}

/** Pull a text delta out of a partial `stream_event`, if present. */
function extractTextDelta(event: SessionEvent): string | null {
  const inner = (event as { event?: { type?: string; delta?: { type?: string; text?: string } } }).event;
  if (inner?.type === "content_block_delta" && inner.delta?.type === "text_delta") {
    return typeof inner.delta.text === "string" ? inner.delta.text : null;
  }
  return null;
}

/** Build the absolute ws:// URL from the current page origin (Vite proxies /ws). */
function buildWsUrl(sessionId: number): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${WS_BASE_PATH}?sessionId=${sessionId}`;
}

/** Map a persisted message row into a stream-event for uniform rendering. */
function historyToEvents(messages: SessionMessage[]): SessionEvent[] {
  return messages.map((m) => {
    // User turns are persisted as { text } with no `type` — rebuild the proper
    // user event so they render as messages (not get bucketed as system noise).
    if (m.event_type === "user_turn") {
      const c = m.content as { text?: unknown } | null;
      const text = c && typeof c.text === "string" ? c.text : "";
      return { type: "user", message: { role: "user", content: [{ type: "text", text }] } };
    }
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
  const [partialText, setPartialText] = useState("");
  const [model, setModelState] = useState<string | null>(null);
  const [slashCommands, setSlashCommands] = useState<string[]>([]);
  const [context, setContext] = useState<{ used: number; window: number } | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Load persisted history once per session, then open the live stream.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    setEvents([]);
    setIsReady(false);
    setStreaming(false);
    setPartialText("");
    setModelState(null);
    setSlashCommands([]);
    setContext(null);
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
        if (typeof parsed.model === "string") setModelState(parsed.model);
        return;
      }
      // Control events (model/skills/context) are live state, not transcript.
      if (parsed.type === "capabilities") {
        if (typeof parsed.model === "string") setModelState(parsed.model);
        if (Array.isArray(parsed.slashCommands)) {
          setSlashCommands(parsed.slashCommands.filter((c): c is string => typeof c === "string"));
        }
        return;
      }
      if (parsed.type === "model_updated") {
        setModelState(typeof parsed.model === "string" ? parsed.model : null);
        return;
      }
      if (parsed.type === "context") {
        if (typeof parsed.used === "number" && typeof parsed.window === "number") {
          setContext({ used: parsed.used, window: parsed.window });
        }
        return;
      }
      if (parsed.type === "process_closed") {
        setStreaming(false);
        setPartialText("");
      }

      // Partial token deltas: accumulate into the live bubble, don't commit.
      if (parsed.type === "stream_event") {
        const delta = extractTextDelta(parsed);
        if (delta) {
          setStreaming(true);
          setPartialText((prev) => prev + delta);
        }
        return;
      }

      // Keep the indicator in sync; a full assistant message commits and clears
      // the live partial; a `result` ends the turn.
      if (parsed.type === "result") {
        setStreaming(false);
        setPartialText("");
      } else if (parsed.type === "assistant") {
        setStreaming(true);
        setPartialText("");
      } else if (parsed.type === "user") {
        setStreaming(true);
      }
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

  const setModel = useCallback((next: string | null) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "set_model", model: next }));
  }, []);

  return { events, status, send, isReady, streaming, partialText, model, slashCommands, context, setModel };
}
