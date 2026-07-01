import type { Response } from "express";
import { logger } from "../../../lib/logger";
import { BrowserError } from "../../../services/BrowserError";

/**
 * Thin response builders — the two-shape envelope, never hand-rolled per handler
 * (Constitution §8.1, §8.2).
 */
export function ok(res: Response, data: unknown, status = 200): Response {
  return res.status(status).json({ success: true, data, error: null });
}

function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details: unknown = null,
): Response {
  return res.status(status).json({ success: false, data: null, error: { code, message, details } });
}

/** Map a browser domain error to an HTTP status in one place (§8.3, §8.4). */
export function handleBrowserError(res: Response, error: unknown): Response {
  if (error instanceof BrowserError) {
    let status = 400;
    if (error.code.includes("NOT_FOUND")) status = 404;
    if (error.code.includes("LIMIT_REACHED")) status = 429;
    if (error.code.includes("HUMAN_DRIVING")) status = 409;
    if (error.code.includes("BAD_URL") || error.code.includes("INPUT_INVALID")) status = 400;
    if (error.code.includes("RECONNECT")) status = 401;
    return fail(res, status, error.code, error.message, error.details);
  }
  // Never leak internals to the client (§3.4); log full detail internally.
  logger.error({ err: error }, "Unhandled browser error");
  return fail(res, 500, "BROWSER_ERROR", "Browser operation failed.");
}
