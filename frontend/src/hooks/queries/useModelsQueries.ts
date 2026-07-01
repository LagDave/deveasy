import { useQuery } from "@tanstack/react-query";
import { getModels } from "../../api/models";

/**
 * The available model catalog (Constitution §14.3, §15.1). The catalog changes
 * rarely, so it's cached for a long stale time and not refetched on focus.
 */
export function useModels() {
  return useQuery({
    queryKey: ["models", "catalog"] as const,
    queryFn: getModels,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
