import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionMessage } from "../api/sessions";
import { getSessionMessages } from "../api/sessions";
import { effortLabel, prettyModel, setLastEffort, setLastModel } from "../utils/modelLabels";

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

/** A message waiting to auto-send when the current turn finishes. */
export interface QueueItem {
  id: number;
  text: string;
}

const WS_BASE_PATH = "/ws/sessions";
/** Context fullness at which we warn the operator (one-time notice). */
const WARN_PCT = 0.8;
/** Context fullness at which we auto-run /compact once (when idle). */
const AUTO_COMPACT_PCT = 0.9;

interface UseSessionResult {
  events: SessionEvent[];
  status: ConnectionStatus;
  send: (text: string) => void;
  isReady: boolean;
  /** True from the moment a turn is sent until the CLI emits its `result` event. */
  streaming: boolean;
  /** Live, not-yet-committed assistant text streaming in token-by-token. */
  partialText: string;
  /** The selected model alias (opus/sonnet/… or null=Default) — known instantly on switch. */
  selectedModel: string | null;
  /** The resolved versioned model from the CLI init event (e.g. claude-opus-4-8); null until the model next runs. */
  resolvedModel: string | null;
  /** The selected thinking effort (low/medium/high/xhigh/max) or null=CLI default. */
  selectedEffort: string | null;
  /** Slash commands / skills available this session (autocomplete source). */
  slashCommands: string[];
  /** Context-window usage for the current session, or null until a result arrives. */
  context: { used: number; window: number } | null;
  /** Switch the session's model — restarts the CLI resumed, preserving context. */
  setModel: (model: string | null) => void;
  /** Change the session's thinking effort — restarts the CLI resumed. */
  setEffort: (effort: string | null) => void;
  /** Messages queued to auto-send when the current turn completes (FIFO). */
  queue: QueueItem[];
  /** Edit a queued message's text. */
  updateQueued: (id: number, text: string) => void;
  /** Remove a queued message. */
  removeQueued: (id: number) => void;
  /** Clear the whole queue. */
  clearQueue: () => void;
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
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [resolvedModel, setResolvedModel] = useState<string | null>(null);
  const [selectedEffort, setSelectedEffort] = useState<string | null>(null);
  const [slashCommands, setSlashCommands] = useState<string[]>([]);
  const [context, setContext] = useState<{ used: number; window: number } | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const idRef = useRef(0);
  /** Mirror of `streaming` for stable callbacks (avoids stale-closure in send). */
  const streamingRef = useRef(false);
  /** One-time flags so the warn notice / auto-compact fire once per crossing. */
  const warnedRef = useRef(false);
  const autoCompactedRef = useRef(false);

  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  // Load persisted history once per session, then open the live stream.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    setEvents([]);
    setIsReady(false);
    setStreaming(false);
    setPartialText("");
    setSelectedModel(null);
    setResolvedModel(null);
    setSelectedEffort(null);
    setSlashCommands([]);
    setContext(null);
    setQueue([]);
    warnedRef.current = false;
    autoCompactedRef.current = false;
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
    // Record the resolved versioned model (drives the pill's version once it runs).
    // The switch notice is emitted immediately in setModel, not here.
    const this_resolveModel = (resolved: string) => {
      setResolvedModel(resolved);
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
        // ready carries the stored selection (model id + effort), not resolved versions.
        if (typeof parsed.model === "string" || parsed.model === null) {
          setSelectedModel(typeof parsed.model === "string" ? parsed.model : null);
        }
        if (typeof parsed.effort === "string" || parsed.effort === null) {
          setSelectedEffort(typeof parsed.effort === "string" ? parsed.effort : null);
        }
        return;
      }
      // Control events (model/skills/context) are live state, not transcript.
      if (parsed.type === "capabilities") {
        if (typeof parsed.model === "string") this_resolveModel(parsed.model);
        if (Array.isArray(parsed.slashCommands)) {
          setSlashCommands(parsed.slashCommands.filter((c): c is string => typeof c === "string"));
        }
        return;
      }
      if (parsed.type === "model_updated") {
        if (typeof parsed.model === "string") this_resolveModel(parsed.model);
        return;
      }
      if (parsed.type === "context") {
        if (typeof parsed.used === "number" && typeof parsed.window === "number") {
          setContext({ used: parsed.used, window: parsed.window });
          const pct = parsed.window > 0 ? parsed.used / parsed.window : 0;
          if (pct < WARN_PCT) {
            // Back to healthy — re-arm both the warning and auto-compact.
            warnedRef.current = false;
            autoCompactedRef.current = false;
          } else if (pct < AUTO_COMPACT_PCT && !warnedRef.current) {
            warnedRef.current = true;
            setEvents((prev) => [
              ...prev,
              { type: "notice", text: `Context ${Math.round(pct * 100)}% — getting full; /compact to free space` },
            ]);
          }
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

  /** Send a turn to the CLI right now (used when idle and to drain the queue). */
  const sendRaw = useCallback((text: string) => {
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

  /** Public send: sends now when idle, otherwise queues to auto-send after the turn. */
  const send = useCallback(
    (text: string) => {
      if (streamingRef.current) {
        setQueue((q) => [...q, { id: (idRef.current += 1), text }]);
        return;
      }
      sendRaw(text);
    },
    [sendRaw],
  );

  const updateQueued = useCallback((id: number, text: string) => {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, text } : it)));
  }, []);
  const removeQueued = useCallback((id: number) => {
    setQueue((q) => q.filter((it) => it.id !== id));
  }, []);
  const clearQueue = useCallback(() => setQueue([]), []);

  // When idle: auto-compact if context is critical (frees space first), else drain
  // the next queued message. One send per idle transition keeps turns sequential.
  useEffect(() => {
    if (status !== "open" || streaming) return;
    if (context && context.window > 0) {
      const pct = context.used / context.window;
      if (pct >= AUTO_COMPACT_PCT && !autoCompactedRef.current) {
        autoCompactedRef.current = true;
        setEvents((prev) => [
          ...prev,
          { type: "notice", text: `Context ${Math.round(pct * 100)}% — auto-compacting` },
        ]);
        sendRaw("/compact");
        return;
      }
    }
    if (queue.length > 0) {
      const next = queue[0];
      setQueue((q) => q.slice(1));
      sendRaw(next.text);
    }
  }, [status, streaming, context, queue, sendRaw]);

  const setModel = useCallback((next: string | null) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "set_model", model: next }));
    // Reflect the choice immediately: pill + picker check, and the in-chat notice —
    // the selection id already carries the version, so no need to wait for the run.
    setSelectedModel(next);
    setLastModel(next); // remember as the default for new sessions
    const label = prettyModel(next) ?? next;
    if (label) setEvents((prev) => [...prev, { type: "notice", text: `Switched to ${label}` }]);
  }, []);

  const setEffort = useCallback((next: string | null) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "set_effort", effort: next }));
    setSelectedEffort(next);
    setLastEffort(next);
    if (next) {
      setEvents((prev) => [...prev, { type: "notice", text: `Effort: ${effortLabel(next)}` }]);
    }
  }, []);

  return {
    events,
    status,
    send,
    isReady,
    streaming,
    partialText,
    selectedModel,
    resolvedModel,
    selectedEffort,
    slashCommands,
    context,
    setModel,
    setEffort,
    queue,
    updateQueued,
    removeQueued,
    clearQueue,
  };
}
