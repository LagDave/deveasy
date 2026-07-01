import { useCallback, useEffect, useRef, useState } from "react";
import type { BrowserController, TabInfo } from "../api/browser";

/**
 * Owns one session's browser screencast WebSocket (/ws/browser), analogous to
 * useTerminalSocket (§14.3): pipes JPEG frames → an <img> the caller attaches via
 * `frameImgRef`, and forwards pointer/keyboard/resize events → the remote page.
 *
 * Frames are written straight to `img.src` through a ref — never React state — so a
 * 30fps screencast doesn't trigger a re-render per frame (mirrors how
 * useTerminalSocket writes PTY output to its container ref). Only the low-frequency
 * metadata (tabs, url, controller, connection state) lives in React state.
 */

/** Pointer button as the protocol names it. */
export type BrowserButton = "left" | "right" | "middle";

/** Input events sent to the remote page — a discriminated union on `type`. */
export type BrowserInputEvent =
  | { type: "mousemove"; x: number; y: number }
  | { type: "mousedown"; x: number; y: number; button: BrowserButton }
  | { type: "mouseup"; x: number; y: number; button: BrowserButton }
  | { type: "click"; x: number; y: number; button: BrowserButton }
  | { type: "wheel"; x: number; y: number; deltaX: number; deltaY: number }
  | { type: "keydown"; key: string }
  | { type: "keyup"; key: string }
  | { type: "text"; text: string };

/** Connection lifecycle of the screencast socket. */
export type BrowserConnState = "connecting" | "open" | "closed" | "error";

export interface UseBrowserSocket {
  /** Attach to the screencast <img>; frames are written to its `src` directly. */
  frameImgRef: React.RefObject<HTMLImageElement | null>;
  tabs: TabInfo[];
  url: string | null;
  title: string | null;
  controller: BrowserController;
  connState: BrowserConnState;
  /** Last error message pushed by the server, if any. */
  errorMessage: string | null;
  sendInput: (event: BrowserInputEvent) => void;
  sendResize: (width: number, height: number) => void;
}

function buildWsUrl(sessionId: number): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/browser?sessionId=${encodeURIComponent(String(sessionId))}`;
}

/** Narrow a parsed WS payload to an object with a string `type` (no `any`, §17.2). */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function parseTabs(value: unknown): TabInfo[] {
  if (!Array.isArray(value)) return [];
  const tabs: TabInfo[] = [];
  for (const raw of value) {
    const rec = asRecord(raw);
    if (!rec) continue;
    if (typeof rec.id !== "string") continue;
    tabs.push({
      id: rec.id,
      title: typeof rec.title === "string" ? rec.title : "",
      url: typeof rec.url === "string" ? rec.url : "",
      active: rec.active === true,
    });
  }
  return tabs;
}

export function useBrowserSocket(sessionId: number): UseBrowserSocket {
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [url, setUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [controller, setController] = useState<BrowserController>(null);
  const [connState, setConnState] = useState<BrowserConnState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setConnState("connecting");
    setErrorMessage(null);
    const ws = new WebSocket(buildWsUrl(sessionId));
    wsRef.current = ws;

    ws.onopen = () => setConnState("open");
    ws.onclose = () => setConnState("closed");
    ws.onerror = () => setConnState("error");

    ws.onmessage = (ev) => {
      const msg = ((): Record<string, unknown> | null => {
        try {
          return asRecord(JSON.parse(ev.data as string));
        } catch {
          return null;
        }
      })();
      if (!msg || typeof msg.type !== "string") return;

      if (msg.type === "frame" && typeof msg.data === "string") {
        const img = frameImgRef.current;
        if (img) img.src = `data:image/jpeg;base64,${msg.data}`;
      } else if (msg.type === "navigate") {
        if (typeof msg.url === "string") setUrl(msg.url);
        if (typeof msg.title === "string") setTitle(msg.title);
        setTabs(parseTabs(msg.tabs));
      } else if (msg.type === "controller") {
        const c = msg.controller;
        setController(c === "agent" || c === "human" ? c : null);
      } else if (msg.type === "closed") {
        setConnState("closed");
      } else if (msg.type === "error") {
        setErrorMessage(typeof msg.message === "string" ? msg.message : "Browser error");
      }
    };

    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, [sessionId]);

  const sendInput = useCallback((event: BrowserInputEvent) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "input", event }));
  }, []);

  const sendResize = useCallback((width: number, height: number) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "resize", width, height }));
  }, []);

  return {
    frameImgRef,
    tabs,
    url,
    title,
    controller,
    connState,
    errorMessage,
    sendInput,
    sendResize,
  };
}
