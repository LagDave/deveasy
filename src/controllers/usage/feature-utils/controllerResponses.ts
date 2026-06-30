import type { Response } from "express";
import { logger } from "../../../lib/logger";

/**
 * Thin response builders for the usage domain — the two-shape envelope, never
 * hand-rolled per handler (Constitution §8.1, §8.2). Mirrors the sessions slice.
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

/** Map an unexpected usage error to a 500 without leaking internals (§3.4, §8.3). */
export function handleUsageError(res: Response, error: unknown): Response {
  logger.error({ err: error }, "Unhandled usage error");
  return fail(res, 500, "USAGE_ERROR", "Usage lookup failed.");
}
