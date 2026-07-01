import type { Request, Response } from "express";
import { childLogger } from "../../lib/logger";
import { BrowserError } from "../../services/BrowserError";
import { BrowserProcessService } from "../../services/BrowserProcessService";
import { handleBrowserError, ok } from "./feature-utils/controllerResponses";

const log = childLogger({ route: "browser" });

/** Parse a positive-int sessionId from the path, or throw a typed error (mirrors SessionsController). */
function requireSessionId(req: Request): number {
  const sessionId = Number(req.params.sessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new BrowserError("BROWSER_INPUT_INVALID", "A valid session id is required.");
  }
  return sessionId;
}

/**
 * Thin controller: validated input -> BrowserProcessService -> shaped response
 * (§7.3). The live screencast stream flows over the /ws/browser WebSocket, not
 * here — these endpoints only open, list, suspend, and manage tabs.
 */
export class BrowserController {
  /** POST /api/browser/:sessionId — open (or return the existing) browser for a session. */
  static async open(req: Request, res: Response): Promise<Response> {
    try {
      const sessionId = requireSessionId(req);
      return ok(res, await BrowserProcessService.ensureForSession(sessionId));
    } catch (error) {
      log.error({ err: error }, "browser open failed");
      return handleBrowserError(res, error);
    }
  }

  /** GET /api/browser — list live browsers (for reattach after reload). */
  static async list(_req: Request, res: Response): Promise<Response> {
    try {
      return ok(res, { browsers: BrowserProcessService.list() });
    } catch (error) {
      log.error({ err: error }, "browser list failed");
      return handleBrowserError(res, error);
    }
  }

  /** GET /api/browser/:sessionId — metadata for one session's browser. */
  static async getInfo(req: Request, res: Response): Promise<Response> {
    try {
      const sessionId = requireSessionId(req);
      const info = BrowserProcessService.getInfo(sessionId);
      if (!info) {
        throw new BrowserError("BROWSER_NOT_FOUND", "No live browser for this session.", { sessionId });
      }
      return ok(res, info);
    } catch (error) {
      log.error({ err: error }, "browser getInfo failed");
      return handleBrowserError(res, error);
    }
  }

  /** POST /api/browser/:sessionId/close — suspend: kill the process, keep the profile. */
  static async close(req: Request, res: Response): Promise<Response> {
    try {
      const sessionId = requireSessionId(req);
      BrowserProcessService.close(sessionId);
      return ok(res, { sessionId });
    } catch (error) {
      log.error({ err: error }, "browser close failed");
      return handleBrowserError(res, error);
    }
  }

  /** GET /api/browser/:sessionId/tabs — list the session browser's tabs. */
  static async listTabs(req: Request, res: Response): Promise<Response> {
    try {
      const sessionId = requireSessionId(req);
      return ok(res, { tabs: BrowserProcessService.listTabs(sessionId) });
    } catch (error) {
      log.error({ err: error }, "browser listTabs failed");
      return handleBrowserError(res, error);
    }
  }

  /** POST /api/browser/:sessionId/tabs — open a new tab and make it active. */
  static async newTab(req: Request, res: Response): Promise<Response> {
    try {
      const sessionId = requireSessionId(req);
      return ok(res, await BrowserProcessService.newTab(sessionId));
    } catch (error) {
      log.error({ err: error }, "browser newTab failed");
      return handleBrowserError(res, error);
    }
  }

  /** DELETE /api/browser/:sessionId/tabs/:tabId — close a tab. */
  static async closeTab(req: Request, res: Response): Promise<Response> {
    try {
      const sessionId = requireSessionId(req);
      const tabId = req.params.tabId;
      if (!tabId) throw new BrowserError("BROWSER_INPUT_INVALID", "A tab id is required.");
      await BrowserProcessService.closeTab(sessionId, tabId);
      return ok(res, {});
    } catch (error) {
      log.error({ err: error }, "browser closeTab failed");
      return handleBrowserError(res, error);
    }
  }

  /** POST /api/browser/:sessionId/tabs/:tabId/activate — bring a tab to the front. */
  static async activateTab(req: Request, res: Response): Promise<Response> {
    try {
      const sessionId = requireSessionId(req);
      const tabId = req.params.tabId;
      if (!tabId) throw new BrowserError("BROWSER_INPUT_INVALID", "A tab id is required.");
      await BrowserProcessService.setActiveTab(sessionId, tabId);
      return ok(res, {});
    } catch (error) {
      log.error({ err: error }, "browser activateTab failed");
      return handleBrowserError(res, error);
    }
  }
}
