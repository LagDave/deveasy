import type { Response } from "express";
import { logger } from "../../../lib/logger";
import { GitError } from "./GitError";

/**
 * Thin response builders — the two-shape envelope, never hand-rolled per handler
 * (Constitution §8.1, §8.2). Copied shape from projects/feature-utils.
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

/** Map a git domain error to an HTTP status in one place (Constitution §8.3, §8.4). */
export function handleGitError(res: Response, error: unknown): Response {
  if (error instanceof GitError) {
    let status = 400;
    if (error.code.includes("NOT_FOUND") || error.code.includes("NO_ACTIVE_PROJECT")) status = 404;
    if (error.code.includes("NOT_A_REPO")) status = 422;
    return fail(res, status, error.code, error.message, error.details);
  }
  // Never leak internals to the client (§3.4); log full detail internally.
  logger.error({ err: error }, "Unhandled git error");
  return fail(res, 500, "GIT_ERROR", "Git operation failed.");
}
