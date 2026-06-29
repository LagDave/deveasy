import type { Response } from "express";
import { logger } from "../../../lib/logger";
import { AgentConfigError } from "./AgentConfigError";

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

/** Map a domain error to an HTTP status in one place (Constitution §8.3). */
export function handleAgentConfigError(res: Response, error: unknown): Response {
  if (error instanceof AgentConfigError) {
    let status = 400;
    if (error.code.includes("NOT_FOUND")) status = 404;
    if (error.code.includes("OUTSIDE_ROOT") || error.code.includes("ACCESS_DENIED")) status = 403;
    if (error.code.includes("EXISTS") || error.code.includes("CONFLICT")) status = 409;
    return fail(res, status, error.code, error.message, error.details);
  }
  // Never leak internals to the client (§3.4); log full detail internally.
  logger.error({ err: error }, "Unhandled agent-config error");
  return fail(res, 500, "AGENT_CONFIG_ERROR", "Agent config operation failed.");
}
