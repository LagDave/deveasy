import { BROWSER_ACTION_TIMEOUT_MS } from "../config/constants";
import { childLogger } from "../lib/logger";
import { BrowserError } from "./BrowserError";
import { BrowserProcessService } from "./BrowserProcessService";

const log = childLogger({ module: "BrowserActionService" });

export interface PageReadout {
  url: string;
  title: string;
  /** Playwright accessibility-tree snapshot (the agent's structured view of the page). */
  accessibility: unknown;
}

/** Normalize + guard an agent/operator-supplied URL (§5.2): only http(s), scheme completed. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new BrowserError("BROWSER_BAD_URL", "A URL is required.");
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new BrowserError("BROWSER_BAD_URL", "That URL is not valid.", { url: raw });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BrowserError("BROWSER_BAD_URL", "Only http and https URLs are allowed.", {
      protocol: parsed.protocol,
    });
  }
  return parsed.toString();
}

/**
 * Semantic browser actions the agent drives through the MCP server (and the REST
 * surface may reuse). Selector- and accessibility-tree based — never coordinate-based
 * (§ tool model = semantic). Every mutating action acquires the agent side of the
 * control lock, so a call made while the operator is driving surfaces as
 * BROWSER_HUMAN_DRIVING. All actions target the session's active tab.
 */
export class BrowserActionService {
  static async navigate(sessionId: number, url: string): Promise<PageReadout> {
    const target = normalizeUrl(url);
    const page = this.beginAction(sessionId);
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: BROWSER_ACTION_TIMEOUT_MS });
    return this.readout(sessionId);
  }

  static async click(sessionId: number, selector: string): Promise<void> {
    const page = this.beginAction(sessionId);
    await page.click(selector, { timeout: BROWSER_ACTION_TIMEOUT_MS });
  }

  static async type(sessionId: number, selector: string, value: string): Promise<void> {
    const page = this.beginAction(sessionId);
    await page.fill(selector, value, { timeout: BROWSER_ACTION_TIMEOUT_MS });
  }

  static async waitFor(sessionId: number, selector: string, timeoutMs?: number): Promise<void> {
    const page = this.beginAction(sessionId);
    await page.waitForSelector(selector, { timeout: timeoutMs ?? BROWSER_ACTION_TIMEOUT_MS });
  }

  /** Read-only — does not fight the operator for the lock, only refreshes activity. */
  static async readPage(sessionId: number): Promise<PageReadout> {
    BrowserProcessService.touch(sessionId);
    return this.readout(sessionId);
  }

  // --- internals ---

  private static beginAction(sessionId: number) {
    BrowserProcessService.acquireControl(sessionId, "agent");
    BrowserProcessService.touch(sessionId);
    return BrowserProcessService.activePage(sessionId);
  }

  private static async readout(sessionId: number): Promise<PageReadout> {
    const page = BrowserProcessService.activePage(sessionId);
    let accessibility: unknown = null;
    try {
      // Modern Playwright semantic snapshot (YAML aria tree) — the agent's structured page view.
      accessibility = await page.locator("body").ariaSnapshot();
    } catch (err) {
      log.warn({ sessionId, err }, "aria snapshot failed");
    }
    return { url: page.url(), title: await page.title(), accessibility };
  }
}
