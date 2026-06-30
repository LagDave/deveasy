import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
  },
});

/** Centralized query keys so cache invalidation is consistent across slices. */
export const QUERY_KEYS = {
  projects: ["projects"] as const,
};
