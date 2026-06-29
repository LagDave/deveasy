/**
 * Typed domain error carrying a machine code; HTTP status mapping lives in the
 * response handler, not scattered across the code (Constitution §8.3).
 */
export class AgentConfigError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "AgentConfigError";
  }
}
