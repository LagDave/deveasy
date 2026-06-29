import { useQuery } from "@tanstack/react-query";
import { getGitHistory, getGitStatus } from "../../api/git";

/** Data-fetching lives in hooks, not in component bodies (Constitution §14.3, §15.1). */

/** Query keys defined locally to avoid editing the shared queryClient (slice lane). */
const GIT_KEYS = {
  history: ["git", "history"] as const,
  status: ["git", "status"] as const,
};

export function useGitHistory() {
  return useQuery({ queryKey: GIT_KEYS.history, queryFn: getGitHistory });
}

export function useGitStatus() {
  return useQuery({ queryKey: GIT_KEYS.status, queryFn: getGitStatus });
}
