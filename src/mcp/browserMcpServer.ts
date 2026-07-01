import type { Express, Request, Response } from "express";
import { z } from "zod";
import { BROWSER_MCP_PATH } from "../config/constants";
import { childLogger } from "../lib/logger";
import { BrowserActionService } from "../services/BrowserActionService";
import { BrowserError } from "../services/BrowserError";
import { BrowserProcessService } from "../services/BrowserProcessService";
import { validateBrowserMcpToken } from "./browserMcpTokens";

const log = childLogger({ module: "browserMcpServer" });

/**
 * In-process MCP server exposing the session's browser as native, semantic agent
 * tools (navigate/click/type/read/tabs — never coordinate-based). Mounted at
 * BROWSER_MCP_PATH on the existing Express server, co-located with
 * BrowserProcessService, so a tool call drives the SAME Chromium the operator is
 * watching — no cross-process hop. The CLI is pointed here via a per-session
 * --mcp-config carrying the session id + token in headers.
 *
 * Transport is stateless Streamable HTTP: a fresh server, bound to the caller's
 * session id, is built per request. Auth is defence-in-depth (§5.4): loopback-only
 * plus a per-session token that must match the one DevEasy issued at spawn.
 *
 * The SDK is ESM-first with a dual CJS build; the backend is CommonJS with
 * moduleResolution "node", which cannot resolve the package's exported subpaths for
 * types. We therefore load it via require() (Node honours the exports map at
 * runtime) against a minimal typed shim, avoiding a project-wide tsconfig change.
 */

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;
interface McpServerLike {
  registerTool(
    name: string,
    config: { title?: string; description: string; inputSchema?: Record<string, unknown> },
    handler: ToolHandler,
  ): void;
  connect(transport: TransportLike): Promise<void>;
  close(): Promise<void>;
}
interface TransportLike {
  handleRequest(req: Request, res: Response, body?: unknown): Promise<void>;
  close(): Promise<void>;
}
type McpServerCtor = new (info: { name: string; version: string }) => McpServerLike;
type TransportCtor = new (opts: { sessionIdGenerator: (() => string) | undefined }) => TransportLike;

/* eslint-disable @typescript-eslint/no-require-imports */
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js") as { McpServer: McpServerCtor };
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js") as {
  StreamableHTTPServerTransport: TransportCtor;
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** Mount the MCP endpoint. Stateless, so only POST carries JSON-RPC; GET/DELETE are 405. */
export function attachBrowserMcp(app: Express): void {
  app.post(BROWSER_MCP_PATH, (req, res) => void handleMcpPost(req, res));
  app.get(BROWSER_MCP_PATH, (_req, res) => methodNotAllowed(res));
  app.delete(BROWSER_MCP_PATH, (_req, res) => methodNotAllowed(res));
  log.info({ path: BROWSER_MCP_PATH }, "Browser MCP endpoint mounted");
}

/** Loopback + per-session token check (§5.4). Exported for unit testing the gate. */
export function authorizeMcpRequest(
  req: Request,
): { ok: true; sessionId: number } | { ok: false; message: string } {
  if (!isLoopback(req)) return { ok: false, message: "Non-loopback origin refused." };
  const sessionId = Number(req.header("x-deveasy-session"));
  if (!Number.isInteger(sessionId) || sessionId <= 0) return { ok: false, message: "Invalid session id." };
  const token = req.header("x-deveasy-token") ?? "";
  if (!validateBrowserMcpToken(sessionId, token)) return { ok: false, message: "Invalid or missing token." };
  return { ok: true, sessionId };
}

async function handleMcpPost(req: Request, res: Response): Promise<void> {
  const auth = authorizeMcpRequest(req);
  if (!auth.ok) {
    deny(res, auth.message);
    return;
  }
  const server = buildServer(auth.sessionId);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    log.error({ sessionId: auth.sessionId, err }, "MCP request handling failed");
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error." }, id: null });
  }
}

/** Build a fresh MCP server whose tools are bound to one session's browser. */
function buildServer(sessionId: number): McpServerLike {
  const server = new McpServer({ name: "deveasy-browser", version: "1.0.0" });

  server.registerTool(
    "browser_navigate",
    { description: "Navigate the browser to a URL; returns the resulting URL, title, and accessibility snapshot.", inputSchema: { url: z.string().describe("Absolute or bare URL, e.g. https://example.com or example.com") } },
    (args) => run(sessionId, async () => {
      await BrowserProcessService.ensureForSession(sessionId);
      return JSON.stringify(await BrowserActionService.navigate(sessionId, String(args.url)));
    }),
  );

  server.registerTool(
    "browser_click",
    { description: "Click the first element matching a Playwright/CSS/text selector.", inputSchema: { selector: z.string() } },
    (args) => run(sessionId, async () => {
      await BrowserProcessService.ensureForSession(sessionId);
      await BrowserActionService.click(sessionId, String(args.selector));
      return `clicked ${String(args.selector)}`;
    }),
  );

  server.registerTool(
    "browser_type",
    { description: "Fill an input/textarea matching a selector with a value.", inputSchema: { selector: z.string(), value: z.string() } },
    (args) => run(sessionId, async () => {
      await BrowserProcessService.ensureForSession(sessionId);
      await BrowserActionService.type(sessionId, String(args.selector), String(args.value));
      return `typed into ${String(args.selector)}`;
    }),
  );

  server.registerTool(
    "browser_read_page",
    { description: "Return the current page's URL, title, and accessibility-tree snapshot — the structured view for finding selectors." },
    () => run(sessionId, async () => {
      await BrowserProcessService.ensureForSession(sessionId);
      return JSON.stringify(await BrowserActionService.readPage(sessionId));
    }),
  );

  server.registerTool(
    "browser_wait_for",
    { description: "Wait until an element matching the selector appears.", inputSchema: { selector: z.string(), timeoutMs: z.number().optional() } },
    (args) => run(sessionId, async () => {
      await BrowserProcessService.ensureForSession(sessionId);
      const timeout = typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;
      await BrowserActionService.waitFor(sessionId, String(args.selector), timeout);
      return `found ${String(args.selector)}`;
    }),
  );

  server.registerTool(
    "browser_new_tab",
    { description: "Open a new browser tab and make it the active/visible one." },
    () => run(sessionId, async () => {
      await BrowserProcessService.ensureForSession(sessionId);
      return JSON.stringify(await BrowserProcessService.newTab(sessionId));
    }),
  );

  server.registerTool(
    "browser_list_tabs",
    { description: "List the browser's open tabs (id, title, url, which is active)." },
    () => run(sessionId, async () => {
      await BrowserProcessService.ensureForSession(sessionId);
      return JSON.stringify(BrowserProcessService.listTabs(sessionId));
    }),
  );

  server.registerTool(
    "browser_set_active_tab",
    { description: "Switch the active/visible tab by its id.", inputSchema: { tabId: z.string() } },
    (args) => run(sessionId, async () => {
      await BrowserProcessService.setActiveTab(sessionId, String(args.tabId));
      return `active tab ${String(args.tabId)}`;
    }),
  );

  server.registerTool(
    "browser_close_tab",
    { description: "Close a tab by its id.", inputSchema: { tabId: z.string() } },
    (args) => run(sessionId, async () => {
      await BrowserProcessService.closeTab(sessionId, String(args.tabId));
      return `closed tab ${String(args.tabId)}`;
    }),
  );

  return server;
}

/** Run a tool body, turning a BrowserError (e.g. BROWSER_HUMAN_DRIVING) into a readable tool error. */
async function run(sessionId: number, fn: () => Promise<string>): Promise<ToolResult> {
  try {
    return { content: [{ type: "text", text: await fn() }] };
  } catch (err) {
    const text = err instanceof BrowserError ? `${err.code}: ${err.message}` : "Browser action failed.";
    log.warn({ sessionId, err }, "MCP tool failed");
    return { content: [{ type: "text", text }], isError: true };
  }
}

function isLoopback(req: Request): boolean {
  const ip = req.ip ?? req.socket.remoteAddress ?? "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function deny(res: Response, message: string): void {
  res.status(403).json({ jsonrpc: "2.0", error: { code: -32001, message }, id: null });
}

function methodNotAllowed(res: Response): void {
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
}
