import { useQuery } from "@tanstack/react-query";
import { getUsageLimits } from "../../api/usage";

/**
 * Subscription usage limits (Constitution §14.3, §15.1). Polled slowly on purpose:
 * the upstream endpoint rate-limits hard, so refetch on an interval — never per
 * render — and keep the value fresh enough for an at-a-glance gauge.
 */

const USAGE_REFETCH_MS = 90_000;

export const USAGE_QUERY_KEYS = {
  limits: ["usage", "limits"] as const,
};

export function useUsageLimits() {
  return useQuery({
    queryKey: USAGE_QUERY_KEYS.limits,
    queryFn: getUsageLimits,
    refetchInterval: USAGE_REFETCH_MS,
    staleTime: USAGE_REFETCH_MS,
    refetchOnWindowFocus: false,
  });
}
