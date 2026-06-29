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
  status: ["azure", "status"] as const,
  pullRequests: ["azure", "pull-requests"] as const,
  pullRequestDetail: (id: number) => ["azure", "pull-requests", id] as const,
};

export function useAzureStatus() {
  return useQuery({ queryKey: AZURE_KEYS.status, queryFn: getAzureStatus });
}

export function useAzurePullRequests(enabled: boolean) {
  return useQuery({
    queryKey: AZURE_KEYS.pullRequests,
    queryFn: getAzurePullRequests,
    enabled,
  });
}

export function useAzurePullRequestDetail(id: number | null) {
  return useQuery({
    queryKey: AZURE_KEYS.pullRequestDetail(id ?? 0),
    queryFn: () => getAzurePullRequestDetail(id as number),
    enabled: id !== null,
  });
}

export function useConnectAzure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AzureConnectInput) => connectAzure(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: AZURE_KEYS.status });
      void qc.invalidateQueries({ queryKey: AZURE_KEYS.pullRequests });
    },
  });
}

export function useCreateAzurePullRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePullRequestInput) => createAzurePullRequest(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: AZURE_KEYS.pullRequests });
    },
  });
}
