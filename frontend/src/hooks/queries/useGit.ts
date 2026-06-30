import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  checkoutGitBranch,
  getGitBranches,
  getGitHistory,
  getGitStatus,
} from "../../api/git";

/** Data-fetching lives in hooks, not in component bodies (Constitution §14.3, §15.1). */

/** Query keys defined locally to avoid editing the shared queryClient (slice lane). */
const GIT_KEYS = {
  history: (projectId: number | null) => ["git", "history", projectId] as const,
  status: (projectId: number | null) => ["git", "status", projectId] as const,
  branches: (projectId: number | null) => ["git", "branches", projectId] as const,
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
    // Keep the branch + change counts "live": poll the working tree and also
    // refresh when the window regains focus (e.g. after editing files elsewhere).
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
}

/** Branch list — fetched lazily (only when the picker is open). */
export function useGitBranches(projectId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: GIT_KEYS.branches(projectId),
    queryFn: () => getGitBranches(projectId as number),
    enabled: Boolean(projectId) && enabled,
  });
}

/** Switch branches; refresh status/branches/history for the project on success. */
export function useCheckoutBranch(projectId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branch: string) => checkoutGitBranch(projectId as number, branch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: GIT_KEYS.status(projectId) });
      void qc.invalidateQueries({ queryKey: GIT_KEYS.branches(projectId) });
      void qc.invalidateQueries({ queryKey: GIT_KEYS.history(projectId) });
    },
  });
}
