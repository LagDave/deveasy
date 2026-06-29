/**
 * Typed domain error carrying a machine code; HTTP status mapping lives in the
 * response handler, not scattered across the code (Constitution §8.3).
 */
export class AzureError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "AzureError";
  }
}

/** A missing/expired PAT or an Azure 401/403 maps to this code → HTTP 401. */
export const AZURE_RECONNECT_REQUIRED = "AZURE_RECONNECT_REQUIRED";
