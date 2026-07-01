/**
 * Typed error for the browser-shell layer — carries a machine code so the REST,
 * WS, and MCP surfaces can map it to a status/response (mirrors TerminalError and
 * the §8.3 domain-error pattern).
 */
export class BrowserError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "BrowserError";
  }
}
