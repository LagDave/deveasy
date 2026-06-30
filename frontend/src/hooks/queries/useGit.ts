import { useQuery } from "@tanstack/react-query";
import { getGitHistory, getGitStatus } from "../../api/git";

/** Data-fetching lives in hooks, not in component bodies (Constitution §14.3, §15.1). */

/** Query keys defined locally to avoid editing the shared queryClient (slice lane). */
const GIT_KEYS = {
  history: (projectId: number | null) => ["git", "history", projectId] as const,
  status: (projectId: number | null) => ["git", "status", projectId] as const,
};

export function useGitHistory(projectId: number | null) {
  return useQuery({
    queryKey: GIT_KEYS.history(projectId),
    queryFn: () => getGitHistory(projectId as number),
    enabled: Boolean(projectId),
  });
}

export function useGitStatus(projectId: number | null) {
  return useQuery({
    queryKey: GIT_KEYS.status(projectId),
    queryFn: () => getGitStatus(projectId as number),
    enabled: Boolean(projectId),
  });
}
