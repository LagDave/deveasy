import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { childLogger } from "../lib/logger";
import { SessionStreamService } from "../controllers/sessions/feature-services/SessionStreamService";

const log = childLogger({ module: "sessionWebSocket" });

/** Path the browser connects to; the Vite dev proxy forwards /ws to the backend. */
const WS_PATH = "/ws/sessions";

/**
 * Attach the session WebSocket relay to the live HTTP server. Handles `upgrade`
 * requests on /ws/sessions, reads the session id from the query string, and hands
 * the socket to the stream service which bridges it to a Claude CLI process.
 *
 * Wired from src/index.ts at the <deveasy:websockets> marker during integration.
 */
export function attachSessionWebSocket(server: Server): void {
  // noServer so we only claim upgrades on our path and leave others alone.
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? "", "http://localhost").pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== WS_PATH) return; // not ours — leave it for other handlers.

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: WebSocket, req) => {
    const sessionId = parseSessionId(req.url);
    if (sessionId === null) {
      log.warn({ url: req.url }, "WS connection without a valid sessionId; closing");
      safeClose(ws, "A valid sessionId query param is required.");
      return;
    }

    log.info({ sessionId }, "WS connection accepted");
    SessionStreamService.bridge(ws, sessionId).catch((err) => {
      log.error({ sessionId, err }, "Failed to bridge session");
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to start session.";
      safeClose(ws, message);
    });
  });

  log.info({ path: WS_PATH }, "Session WebSocket relay attached");
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
