import type { Response } from "express";
import { logger } from "../../../lib/logger";
import { ProjectError } from "./ProjectError";

/**
 * Thin response builders — the two-shape envelope, never hand-rolled per handler
 * (Constitution §8.1, §8.2). Copied shape from gbp-automation/feature-utils.
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

/** Map a domain error to an HTTP status in one place (Constitution §8.3). */
export function handleProjectError(res: Response, error: unknown): Response {
  if (error instanceof ProjectError) {
    let status = 400;
    if (error.code.includes("NOT_FOUND")) status = 404;
    if (error.code.includes("ACCESS_DENIED") || error.code.includes("OUTSIDE_ROOT")) status = 403;
    if (error.code.includes("CONFLICT") || error.code.includes("EXISTS")) status = 409;
    // Server-side operations that fail (e.g. git init) are 500s, not client errors.
    if (error.code.includes("FAILED")) status = 500;
    return fail(res, status, error.code, error.message, error.details);
  }
  // Never leak internals to the client (§3.4); log full detail internally.
  logger.error({ err: error }, "Unhandled project error");
  return fail(res, 500, "PROJECT_ERROR", "Project operation failed.");
}
