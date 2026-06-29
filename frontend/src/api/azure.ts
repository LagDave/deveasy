import { apiGet, apiPost, apiPut } from "./index";

/** Thin typed functions over the HTTP client — one file per backend domain (§12.1). */

export type AzureConnectionStatus = "connected" | "expired" | "disconnected" | "unmapped";

export interface AzureConnectionState {
  status: AzureConnectionStatus;
  organization: string | null;
  project: string | null;
  repository: string | null;
}

export interface AzureConnectInput {
  organization: string;
  project: string;
  repository: string;
  pat: string;
}

export interface AzurePullRequestRef {
  pullRequestId: number;
  title: string;
  status: string;
  sourceRefName: string;
  targetRefName: string;
  createdBy: { displayName: string } | null;
  creationDate: string;
}

export interface AzureReviewerVote {
  displayName: string;
  vote: number;
}

export interface AzureThreadComment {
  id: number;
  author: string;
  content: string;
  publishedDate: string;
}

export interface AzureThread {
  id: number;
  status: string | null;
  comments: AzureThreadComment[];
}

export interface AzureChangedFile {
  path: string;
  changeType: string;
}

export interface AzurePullRequestDetail {
  pullRequestId: number;
  title: string;
  description: string;
  status: string;
  sourceRefName: string;
  targetRefName: string;
  createdBy: string | null;
  creationDate: string;
  reviewers: AzureReviewerVote[];
  threads: AzureThread[];
  changedFiles: AzureChangedFile[];
}

export interface CreatePullRequestInput {
  sourceRefName: string;
  targetRefName: string;
  title: string;
  description: string;
}

export async function getAzureStatus(): Promise<AzureConnectionState> {
  return apiGet<AzureConnectionState>("/api/azure/status");
}

export async function connectAzure(input: AzureConnectInput): Promise<AzureConnectionState> {
  return apiPut<AzureConnectionState>("/api/azure/connection", input);
}

export async function getAzurePullRequests(): Promise<AzurePullRequestRef[]> {
  const data = await apiGet<{ pullRequests: AzurePullRequestRef[] }>("/api/azure/pull-requests");
  return data.pullRequests;
}

export async function getAzurePullRequestDetail(id: number): Promise<AzurePullRequestDetail> {
  return apiGet<AzurePullRequestDetail>(`/api/azure/pull-requests/${id}`);
}

export async function createAzurePullRequest(
  input: CreatePullRequestInput,
): Promise<AzurePullRequestRef> {
  return apiPost<AzurePullRequestRef>("/api/azure/pull-requests", input);
}
