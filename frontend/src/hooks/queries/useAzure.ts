import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectAzure,
  createAzurePullRequest,
  getAzurePullRequestDetail,
  getAzurePullRequests,
  getAzureStatus,
  type AzureConnectInput,
  type CreatePullRequestInput,
} from "../../api/azure";

/** Data-fetching lives in hooks, not in component bodies (Constitution §14.3, §15.1). */

/** Query keys defined locally to avoid editing the shared queryClient (slice lane). */
const AZURE_KEYS = {
  status: (projectId: number | null) => ["azure", "status", projectId] as const,
  pullRequests: (projectId: number | null) => ["azure", "pull-requests", projectId] as const,
  pullRequestDetail: (projectId: number | null, id: number) =>
    ["azure", "pull-requests", projectId, id] as const,
};

export function useAzureStatus(projectId: number | null) {
  return useQuery({
    queryKey: AZURE_KEYS.status(projectId),
    queryFn: () => getAzureStatus(projectId as number),
    enabled: Boolean(projectId),
  });
}

export function useAzurePullRequests(projectId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: AZURE_KEYS.pullRequests(projectId),
    queryFn: () => getAzurePullRequests(projectId as number),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useAzurePullRequestDetail(projectId: number | null, id: number | null) {
  return useQuery({
    queryKey: AZURE_KEYS.pullRequestDetail(projectId, id ?? 0),
    queryFn: () => getAzurePullRequestDetail(projectId as number, id as number),
    enabled: Boolean(projectId) && id !== null,
  });
}

export function useConnectAzure(projectId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AzureConnectInput) => connectAzure(projectId as number, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: AZURE_KEYS.status(projectId) });
      void qc.invalidateQueries({ queryKey: AZURE_KEYS.pullRequests(projectId) });
    },
  });
}

export function useCreateAzurePullRequest(projectId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePullRequestInput) => createAzurePullRequest(projectId as number, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: AZURE_KEYS.pullRequests(projectId) });
    },
  });
}
