import { randomUUID } from "node:crypto";

/**
 * Per-session bearer tokens for the browser MCP endpoint. DevEasy issues a token
 * when it spawns a session's CLI (writing it into that session's --mcp-config), and
 * the MCP server validates it on every call (§5.4). In-memory only — a token dies
 * with the process, which is correct: a stale config from a previous run cannot
 * drive a browser. Keyed by the DevEasy session id (a number).
 */
const tokens = new Map<number, string>();

/** Mint (or rotate) the token for a session; returns the value to embed in the MCP config. */
export function issueBrowserMcpToken(sessionId: number): string {
  const token = randomUUID();
  tokens.set(sessionId, token);
  return token;
}

/** Constant-shape check that a presented token matches the session's issued token. */
export function validateBrowserMcpToken(sessionId: number, token: string): boolean {
  const expected = tokens.get(sessionId);
  return expected !== undefined && token.length > 0 && expected === token;
}

/** Drop a session's token (on session stop/delete) so the config can no longer authorize. */
export function revokeBrowserMcpToken(sessionId: number): void {
  tokens.delete(sessionId);
}
