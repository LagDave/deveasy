import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { childLogger } from "../lib/logger";
import { TerminalProcessService } from "../services/TerminalProcessService";

const log = childLogger({ module: "terminalWebSocket" });

/** Path the browser connects to for a PTY stream; coexists with /ws/sessions. */
const WS_PATH = "/ws/terminal";

/**
 * Attach the terminal WebSocket relay to the live HTTP server. Claims upgrades on
 * /ws/terminal only (noServer), leaving /ws/sessions and Vite HMR untouched. Reads
 * the terminalId from the query string, attaches to the live PTY (which replays
 * scrollback), and bridges output→client / input+resize→PTY. Closing the socket
 * detaches the subscriber but never kills the PTY (§ persistence requirement).
 */
export function attachTerminalWebSocket(server: Server): void {
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
    const terminalId = parseTerminalId(req.url);
    if (!terminalId) {
      safeClose(ws, "A valid terminalId query param is required.");
      return;
    }

    let detach: (() => void) | null = null;
    try {
      detach = TerminalProcessService.attach(terminalId, {
        onData: (data) => send(ws, { type: "data", data }),
        onExit: (code) => {
          send(ws, { type: "exit", code });
          try {
            ws.close();
          } catch {
            ws.terminate();
          }
        },
      });
    } catch (err) {
      log.warn({ terminalId, err }, "Failed to attach terminal");
      safeClose(ws, err instanceof Error ? err.message : "Failed to attach terminal.");
      return;
    }

    log.info({ terminalId }, "Terminal WS connection accepted");

    ws.on("message", (raw) => {
      let msg: { type?: string; data?: unknown; cols?: unknown; rows?: unknown };
      try {
        msg = JSON.parse(raw.toString()) as typeof msg;
      } catch {
        return; // ignore unparseable frames
      }
      if (msg.type === "input" && typeof msg.data === "string") {
        TerminalProcessService.write(terminalId, msg.data);
      } else if (msg.type === "resize" && typeof msg.cols === "number" && typeof msg.rows === "number") {
        TerminalProcessService.resize(terminalId, msg.cols, msg.rows);
      }
    });

    ws.on("close", () => {
      detach?.();
    });
  });

  log.info({ path: WS_PATH }, "Terminal WebSocket relay attached");
}

/** Extract the terminalId (a UUID string) from the upgrade request URL. */
function parseTerminalId(url: string | undefined): string | null {
  try {
    const parsed = new URL(url ?? "", "http://localhost");
    const id = parsed.searchParams.get("terminalId");
    return id && id.length > 0 ? id : null;
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
