import { apiGet } from "./index";

/**
 * Usage REST domain (Constitution §12.1). Subscription limit windows come from the
 * backend, which reads them server-side — the OAuth token never reaches the client.
 * Types are local to this slice, matching the sessions domain convention.
 */

/** One subscription limit window. `utilization` is a 0–100 percent. */
export interface UsageWindow {
  utilization: number;
  resetsAt: string | null;
}

export interface UsageLimits {
  available: boolean;
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
  fetchedAt: string;
}

export async function getUsageLimits(): Promise<UsageLimits> {
  const data = await apiGet<{ limits: UsageLimits }>("/api/usage/limits");
  return data.limits;
}
