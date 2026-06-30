import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  checkoutGitBranch,
  commitGit,
  createGitBranch,
  getGitBranches,
  getGitHistory,
  getGitStatus,
  mergeGitToMain,
  pushGit,
  stageGitPaths,
  unstageGitPaths,
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

/** Refresh status/branches/history for a project after any git write. */
function invalidateGit(qc: QueryClient, projectId: number | null): void {
  void qc.invalidateQueries({ queryKey: GIT_KEYS.status(projectId) });
  void qc.invalidateQueries({ queryKey: GIT_KEYS.branches(projectId) });
  void qc.invalidateQueries({ queryKey: GIT_KEYS.history(projectId) });
}

/** Switch branches; refresh status/branches/history for the project on success. */
export function useCheckoutBranch(projectId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branch: string) => checkoutGitBranch(projectId as number, branch),
    onSuccess: () => invalidateGit(qc, projectId),
  });
}

/** Stage working-tree paths. */
export function useStagePaths(projectId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paths: string[]) => stageGitPaths(projectId as number, paths),
    onSuccess: () => invalidateGit(qc, projectId),
  });
}

/** Unstage paths. */
export function useUnstagePaths(projectId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paths: string[]) => unstageGitPaths(projectId as number, paths),
    onSuccess: () => invalidateGit(qc, projectId),
  });
}

/** Commit staged changes. */
export function useCommit(projectId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => commitGit(projectId as number, message),
    onSuccess: () => invalidateGit(qc, projectId),
  });
}

/** Create + switch to a new branch. */
export function useCreateBranch(projectId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createGitBranch(projectId as number, name),
    onSuccess: () => invalidateGit(qc, projectId),
  });
}

/** Push the current branch. */
export function usePush(projectId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => pushGit(projectId as number),
    onSuccess: () => invalidateGit(qc, projectId),
  });
}

/** Merge the current branch into main and push. */
export function useMergeToMain(projectId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => mergeGitToMain(projectId as number),
    onSuccess: () => invalidateGit(qc, projectId),
  });
}
