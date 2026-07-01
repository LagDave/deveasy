import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { childLogger } from "../lib/logger";
import { BrowserActionService } from "../services/BrowserActionService";
import { BrowserError } from "../services/BrowserError";
import { BrowserProcessService, type BrowserInputEvent } from "../services/BrowserProcessService";

const log = childLogger({ module: "browserWebSocket" });

/** Path the operator connects to for a browser screencast; coexists with /ws/terminal & /ws/sessions. */
const WS_PATH = "/ws/browser";

/**
 * Attach the browser screencast WebSocket relay to the live HTTP server. Claims
 * upgrades on /ws/browser only (noServer), leaving /ws/terminal, /ws/sessions, and
 * Vite HMR untouched. Reads the sessionId from the query string, lazily launches (or
 * reattaches to) the session's persistent browser, and bridges JPEG frames + chrome
 * notices → client / input + resize → the browser. Closing the socket detaches the
 * subscriber but never kills the browser (§ persistence requirement).
 */
export function attachBrowserWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? "", "http://localhost").pathname;
    } catch {
      return; // malformed — leave it for other handlers / let it time out
    }
    if (pathname !== WS_PATH) return; // not ours — leave it for other handlers.

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: WebSocket, req) => {
    const sessionId = parseSessionId(req.url);
    if (sessionId === null) {
      safeClose(ws, "A valid sessionId query param is required.");
      return;
    }

    void attachSocket(ws, sessionId);
  });

  log.info({ path: WS_PATH }, "Browser WebSocket relay attached");
}

/** Lazily launch the session's browser, then bridge it to this socket. */
async function attachSocket(ws: WebSocket, sessionId: number): Promise<void> {
  try {
    await BrowserProcessService.ensureForSession(sessionId);
  } catch (err) {
    log.warn({ sessionId, err }, "Failed to ensure browser for session");
    safeClose(ws, err instanceof Error ? err.message : "Failed to start the browser.");
    return;
  }

  const detach = BrowserProcessService.attach(sessionId, {
    onFrame: (data) => send(ws, { type: "frame", data }),
    onEvent: (evt) => send(ws, evt), // evt already carries a discriminant `type`
  });

  log.info({ sessionId }, "Browser WS connection accepted");

  ws.on("message", (raw) => {
    let msg: { type?: string; event?: unknown; url?: unknown; width?: unknown; height?: unknown };
    try {
      msg = JSON.parse(raw.toString()) as typeof msg;
    } catch {
      return; // ignore unparseable frames
    }
    if (msg.type === "input" && msg.event) {
      void dispatchInput(sessionId, msg.event as BrowserInputEvent);
    } else if (msg.type === "navigate" && typeof msg.url === "string") {
      void humanNavigate(ws, sessionId, msg.url);
    } else if (msg.type === "resize" && typeof msg.width === "number" && typeof msg.height === "number") {
      void BrowserProcessService.resize(sessionId, msg.width, msg.height);
    }
  });

  ws.on("close", () => {
    detach();
  });
}

/** Forward one input event; a failure logs but never crashes the socket. */
async function dispatchInput(sessionId: number, event: BrowserInputEvent): Promise<void> {
  try {
    await BrowserProcessService.dispatchInput(sessionId, event);
  } catch (err) {
    log.warn({ sessionId, err }, "Browser input dispatch failed");
  }
}

/** Navigate as the operator (address bar); surface a friendly error back to the client. */
async function humanNavigate(ws: WebSocket, sessionId: number, url: string): Promise<void> {
  try {
    await BrowserActionService.navigate(sessionId, url, "human");
  } catch (err) {
    log.warn({ sessionId, err }, "Browser navigate failed");
    send(ws, { type: "error", message: err instanceof BrowserError ? err.message : "Navigation failed." });
  }
}

/** Extract a positive integer sessionId from the upgrade request URL. */
function parseSessionId(url: string | undefined): number | null {
  try {
    const parsed = new URL(url ?? "", "http://localhost");
    const raw = Number(parsed.searchParams.get("sessionId"));
    return Number.isInteger(raw) && raw > 0 ? raw : null;
  } catch {
    return null;
  }
}

function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // socket went away mid-send; the close handler will detach
    }
  }
}

function safeClose(ws: WebSocket, message: string): void {
  try {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "error", message }));
    }
    ws.close();
  } catch {
    ws.terminate();
  }
}
