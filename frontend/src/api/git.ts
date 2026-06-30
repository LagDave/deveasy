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

export async function stageGitPaths(projectId: number, paths: string[]): Promise<GitStatus> {
  return apiPost<GitStatus>("/api/git/stage", { projectId, paths });
}

export async function unstageGitPaths(projectId: number, paths: string[]): Promise<GitStatus> {
  return apiPost<GitStatus>("/api/git/unstage", { projectId, paths });
}

export async function commitGit(projectId: number, message: string): Promise<GitStatus> {
  return apiPost<GitStatus>("/api/git/commit", { projectId, message });
}

export async function createGitBranch(projectId: number, name: string): Promise<GitStatus> {
  return apiPost<GitStatus>("/api/git/branch", { projectId, name });
}

export async function pushGit(projectId: number): Promise<GitStatus> {
  return apiPost<GitStatus>("/api/git/push", { projectId });
}

export async function mergeGitToMain(projectId: number): Promise<GitStatus> {
  return apiPost<GitStatus>("/api/git/merge-main", { projectId });
}
