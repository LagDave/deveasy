import http from "node:http";
import { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserFrameSubscriber, BrowserInputEvent } from "../../services/BrowserProcessService";
import { attachBrowserWebSocket } from "../browserWebSocket";

// Mock the whole service — no real Chromium is launched under test.
vi.mock("../../services/BrowserProcessService", () => ({
  BrowserProcessService: {
    ensureForSession: vi.fn(),
    attach: vi.fn(),
    dispatchInput: vi.fn(),
    resize: vi.fn(),
  },
}));

// Import AFTER the mock so we get the mocked object.
import { BrowserProcessService } from "../../services/BrowserProcessService";

const svc = vi.mocked(BrowserProcessService);
const SESSION_ID = 7;

let server: http.Server;
let port: number;
/** The last subscriber handed to attach(), so tests can push frames/events at the socket. */
let lastSubscriber: BrowserFrameSubscriber | null;
/** The detach fn attach() returns, spied so we can assert it fires on close. */
let detach: ReturnType<typeof vi.fn>;

/** Await one JSON message of a given `type` (or the first message when type omitted). */
function nextMessage<T = { type?: string; [k: string]: unknown }>(
  ws: WebSocket,
  type?: string,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type ?? "message"}`)), timeoutMs);
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString()) as T & { type?: string };
      if (!type || msg.type === type) {
        clearTimeout(timer);
        resolve(msg);
      }
    });
    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Open a socket and wait until the relay has attached a subscriber for it. */
async function connectAndAwaitAttach(query: string): Promise<WebSocket> {
  const ws = new WebSocket(`ws://localhost:${port}/ws/browser${query}`);
  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve());
    ws.on("error", reject);
  });
  // ensureForSession + attach happen on the server tick right after open.
  await vi.waitFor(() => expect(svc.attach).toHaveBeenCalled());
  return ws;
}

beforeEach(async () => {
  lastSubscriber = null;
  detach = vi.fn();
  svc.ensureForSession.mockResolvedValue({
    sessionId: SESSION_ID,
    createdAt: "",
    controller: null,
    tabs: [],
  });
  svc.attach.mockImplementation((_id: number, sub: BrowserFrameSubscriber) => {
    lastSubscriber = sub;
    return detach;
  });
  svc.dispatchInput.mockResolvedValue(undefined);
  svc.resize.mockResolvedValue(undefined);

  server = http.createServer();
  attachBrowserWebSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.clearAllMocks();
});

describe("browserWebSocket", () => {
  it("claims only /ws/browser and leaves other upgrade paths to their own relay", async () => {
    // Register a second relay on /ws/terminal on the SAME server (mirrors production
    // coexistence). A client on that path must be served by the foreign relay, and
    // the browser service must never be touched — proving our handler returns early.
    const foreign = new WebSocketServer({ noServer: true });
    const foreignConn = new Promise<void>((resolve) => foreign.on("connection", () => resolve()));
    server.on("upgrade", (req, socket, head) => {
      if (new URL(req.url ?? "", "http://localhost").pathname !== "/ws/terminal") return;
      foreign.handleUpgrade(req, socket, head, (ws) => foreign.emit("connection", ws, req));
    });

    const other = new WebSocket(`ws://localhost:${port}/ws/terminal?sessionId=${SESSION_ID}`);
    await new Promise<void>((resolve, reject) => {
      other.on("open", () => resolve());
      other.on("error", reject);
    });
    await foreignConn; // the foreign relay — not ours — accepted it

    expect(svc.ensureForSession).not.toHaveBeenCalled();
    expect(svc.attach).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => {
      other.on("close", () => resolve());
      other.close();
    });
    foreign.close();
  });

  it("rejects a connection without a sessionId", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/browser`);
    const err = await nextMessage<{ type?: string; message?: string }>(ws, "error");
    expect(err.type).toBe("error");
    expect(svc.ensureForSession).not.toHaveBeenCalled();
  });

  it("rejects a non-positive-integer sessionId", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/browser?sessionId=abc`);
    const err = await nextMessage<{ type?: string }>(ws, "error");
    expect(err.type).toBe("error");
    expect(svc.ensureForSession).not.toHaveBeenCalled();
  });

  it("lazily launches the browser and forwards frames + events to the client", async () => {
    const ws = await connectAndAwaitAttach(`?sessionId=${SESSION_ID}`);
    expect(svc.ensureForSession).toHaveBeenCalledWith(SESSION_ID);
    expect(svc.attach).toHaveBeenCalledWith(SESSION_ID, expect.any(Object));

    const frame = nextMessage<{ type?: string; data?: string }>(ws, "frame");
    lastSubscriber?.onFrame("AAAA");
    expect(await frame).toEqual({ type: "frame", data: "AAAA" });

    const nav = nextMessage<{ type?: string; url?: string }>(ws, "navigate");
    lastSubscriber?.onEvent?.({ type: "navigate", url: "https://x.test", title: "X", tabs: [] });
    expect((await nav).url).toBe("https://x.test");

    ws.close();
  });

  it("closes the socket with the error message when ensureForSession throws", async () => {
    svc.ensureForSession.mockRejectedValueOnce(new Error("Too many browsers"));
    const ws = new WebSocket(`ws://localhost:${port}/ws/browser?sessionId=${SESSION_ID}`);
    const err = await nextMessage<{ type?: string; message?: string }>(ws, "error");
    expect(err.message).toBe("Too many browsers");
    expect(svc.attach).not.toHaveBeenCalled();
  });

  it("forwards input messages to dispatchInput", async () => {
    const ws = await connectAndAwaitAttach(`?sessionId=${SESSION_ID}`);
    const event: BrowserInputEvent = { type: "click", x: 12, y: 34, button: "left" };
    ws.send(JSON.stringify({ type: "input", event }));
    await vi.waitFor(() => expect(svc.dispatchInput).toHaveBeenCalledWith(SESSION_ID, event));
    ws.close();
  });

  it("swallows a dispatchInput rejection without crashing the socket", async () => {
    svc.dispatchInput.mockRejectedValueOnce(new Error("BROWSER_HUMAN_DRIVING"));
    const ws = await connectAndAwaitAttach(`?sessionId=${SESSION_ID}`);
    ws.send(JSON.stringify({ type: "input", event: { type: "keydown", key: "a" } }));
    await vi.waitFor(() => expect(svc.dispatchInput).toHaveBeenCalled());
    // Socket is still open after the rejected dispatch.
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it("forwards resize messages to resize", async () => {
    const ws = await connectAndAwaitAttach(`?sessionId=${SESSION_ID}`);
    ws.send(JSON.stringify({ type: "resize", width: 1024, height: 768 }));
    await vi.waitFor(() => expect(svc.resize).toHaveBeenCalledWith(SESSION_ID, 1024, 768));
    ws.close();
  });

  it("ignores unparseable and malformed messages", async () => {
    const ws = await connectAndAwaitAttach(`?sessionId=${SESSION_ID}`);
    ws.send("not json");
    ws.send(JSON.stringify({ type: "resize", width: "big", height: 768 }));
    ws.send(JSON.stringify({ type: "input" })); // no event
    // Give the server a tick to (not) act on them.
    await new Promise((r) => setTimeout(r, 100));
    expect(svc.resize).not.toHaveBeenCalled();
    expect(svc.dispatchInput).not.toHaveBeenCalled();
    ws.close();
  });

  it("detaches the subscriber when the socket closes", async () => {
    const ws = await connectAndAwaitAttach(`?sessionId=${SESSION_ID}`);
    ws.close();
    await vi.waitFor(() => expect(detach).toHaveBeenCalledTimes(1));
  });
});
