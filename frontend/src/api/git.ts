import { apiGet, apiPost } from "./index";

/** Thin typed functions over the HTTP client — one file per backend domain (§12.1). */

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  subject: string;
}

export interface GitStatusFile {
  path: string;
  state: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  files: GitStatusFile[];
  isClean: boolean;
}

export interface GitHistory {
  branch: string;
  commits: GitCommit[];
}

export async function getGitHistory(projectId: number): Promise<GitHistory> {
  return apiGet<GitHistory>(`/api/git/history?projectId=${projectId}`);
}

export async function getGitStatus(projectId: number): Promise<GitStatus> {
  return apiGet<GitStatus>(`/api/git/status?projectId=${projectId}`);
}

export interface GitBranches {
  current: string;
  branches: string[];
}

export async function getGitBranches(projectId: number): Promise<GitBranches> {
  return apiGet<GitBranches>(`/api/git/branches?projectId=${projectId}`);
}

export async function checkoutGitBranch(projectId: number, branch: string): Promise<GitStatus> {
  return apiPost<GitStatus>("/api/git/checkout", { projectId, branch });
}
