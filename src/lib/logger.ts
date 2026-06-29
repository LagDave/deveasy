import pino from "pino";
import { loadConfig } from "../config";

/**
 * Single Pino logger instance. No console.* anywhere in production code
 * (Constitution §9.1). Import this everywhere logging is needed.
 */
export const logger = pino({
  level: loadConfig().logLevel,
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true } },
});

/** Child logger carrying a stable context (route, projectId, sessionId, …). */
export function childLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
