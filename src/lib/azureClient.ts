import { childLogger } from "./logger";

const log = childLogger({ module: "azureClient" });

/** Pinned Azure DevOps REST API version — fail loud if the shape ever shifts (§ risk). */
export const AZURE_API_VERSION = "7.1";
const AZURE_BASE_URL = "https://dev.azure.com";

/** Azure auth failures (401/403) that mean the PAT must be re-entered. */
export class AzureAuthError extends Error {
  constructor(
    public status: number,
    message = "Azure authentication failed",
  ) {
    super(message);
    this.name = "AzureAuthError";
  }
}

/** A generic Azure REST failure with a safe, PAT-free message. */
export class AzureRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AzureRequestError";
  }
}

export interface AzureTarget {
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

/** Mask anything that could be a PAT so it never reaches a log or thrown message. */
function redact(value: string): string {
  return value.replace(/[A-Za-z0-9+/=]{20,}/g, "[REDACTED]");
}

function basicAuthHeader(pat: string): string {
  // Azure DevOps Basic auth: empty username, PAT as password.
  return `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;
}

function repoBase(t: AzureTarget): string {
  const org = encodeURIComponent(t.organization);
  const project = encodeURIComponent(t.project);
  const repo = encodeURIComponent(t.repository);
  return `${AZURE_BASE_URL}/${org}/${project}/_apis/git/repositories/${repo}`;
}

function withApiVersion(url: string, extra?: Record<string, string>): string {
  const u = new URL(url);
  u.searchParams.set("api-version", AZURE_API_VERSION);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
  }
  return u.toString();
}

/**
 * Single low-level Azure REST call. The PAT is used ONLY here for the auth header,
 * and is never logged or placed into a thrown message (Constitution §5.3, §3.4).
 */
async function azureFetch<T>(
  pat: string,
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: basicAuthHeader(pat),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (err) {
    // Network-level failure — log without the PAT.
    log.error({ url: redact(url), err }, "Azure request transport failure");
    throw new AzureRequestError(0, "Azure request failed");
  }

  if (res.status === 401 || res.status === 403) {
    log.warn({ url: redact(url), status: res.status }, "Azure auth rejected (reconnect required)");
    throw new AzureAuthError(res.status);
  }

  if (!res.ok) {
    // Read the body for context but redact before it can be logged or surfaced.
    let detail = "";
    try {
      detail = redact(await res.text());
    } catch {
      detail = "";
    }
    log.error({ url: redact(url), status: res.status, detail }, "Azure request failed");
    throw new AzureRequestError(res.status, `Azure request failed (${res.status})`);
  }

  try {
    return (await res.json()) as T;
  } catch (err) {
    log.error({ url: redact(url), err }, "Azure response was not valid JSON");
    throw new AzureRequestError(res.status, "Azure returned an unexpected response shape");
  }
}

interface AzurePrListRaw {
  value: Array<{
    pullRequestId: number;
    title: string;
    status: string;
    sourceRefName: string;
    targetRefName: string;
    createdBy?: { displayName?: string };
    creationDate: string;
  }>;
}

/** List active pull requests for the mapped repository. */
export async function listPullRequests(t: AzureTarget): Promise<AzurePullRequestRef[]> {
  const url = withApiVersion(`${repoBase(t)}/pullrequests`, { "searchCriteria.status": "active" });
  const raw = await azureFetch<AzurePrListRaw>(t.pat, url);
  return (raw.value ?? []).map((pr) => ({
    pullRequestId: pr.pullRequestId,
    title: pr.title,
    status: pr.status,
    sourceRefName: pr.sourceRefName,
    targetRefName: pr.targetRefName,
    createdBy: pr.createdBy?.displayName ? { displayName: pr.createdBy.displayName } : null,
    creationDate: pr.creationDate,
  }));
}

interface AzurePrRaw {
  pullRequestId: number;
  title: string;
  description?: string;
  status: string;
  sourceRefName: string;
  targetRefName: string;
  createdBy?: { displayName?: string };
  creationDate: string;
  reviewers?: Array<{ displayName?: string; vote?: number }>;
}

interface AzureThreadsRaw {
  value: Array<{
    id: number;
    status?: string;
    comments?: Array<{
      id: number;
      author?: { displayName?: string };
      content?: string;
      publishedDate?: string;
    }>;
  }>;
}

interface AzureIterationsRaw {
  value: Array<{ id: number }>;
}

interface AzureIterationChangesRaw {
  changeEntries?: Array<{ item?: { path?: string }; changeType?: string }>;
}

/** Full PR detail: status, reviewers/votes, comment threads, and changed files. */
export async function getPullRequestDetail(
  t: AzureTarget,
  pullRequestId: number,
): Promise<AzurePullRequestDetail> {
  const pr = await azureFetch<AzurePrRaw>(
    t.pat,
    withApiVersion(`${repoBase(t)}/pullrequests/${pullRequestId}`),
  );
  const threadsRaw = await azureFetch<AzureThreadsRaw>(
    t.pat,
    withApiVersion(`${repoBase(t)}/pullrequests/${pullRequestId}/threads`),
  );
  const changedFiles = await getChangedFiles(t, pullRequestId);

  return {
    pullRequestId: pr.pullRequestId,
    title: pr.title,
    description: pr.description ?? "",
    status: pr.status,
    sourceRefName: pr.sourceRefName,
    targetRefName: pr.targetRefName,
    createdBy: pr.createdBy?.displayName ?? null,
    creationDate: pr.creationDate,
    reviewers: (pr.reviewers ?? []).map((r) => ({
      displayName: r.displayName ?? "Unknown",
      vote: r.vote ?? 0,
    })),
    threads: (threadsRaw.value ?? []).map((th) => ({
      id: th.id,
      status: th.status ?? null,
      comments: (th.comments ?? []).map((c) => ({
        id: c.id,
        author: c.author?.displayName ?? "Unknown",
        content: c.content ?? "",
        publishedDate: c.publishedDate ?? "",
      })),
    })),
    changedFiles,
  };
}

/** Changed files from the latest PR iteration. */
async function getChangedFiles(
  t: AzureTarget,
  pullRequestId: number,
): Promise<AzureChangedFile[]> {
  const iterations = await azureFetch<AzureIterationsRaw>(
    t.pat,
    withApiVersion(`${repoBase(t)}/pullrequests/${pullRequestId}/iterations`),
  );
  const latest = (iterations.value ?? []).reduce(
    (max, it) => (it.id > max ? it.id : max),
    0,
  );
  if (latest === 0) return [];

  const changes = await azureFetch<AzureIterationChangesRaw>(
    t.pat,
    withApiVersion(`${repoBase(t)}/pullrequests/${pullRequestId}/iterations/${latest}/changes`),
  );
  return (changes.changeEntries ?? [])
    .filter((c) => c.item?.path)
    .map((c) => ({ path: c.item?.path ?? "", changeType: c.changeType ?? "edit" }));
}

/** Open a new pull request in the mapped repository. */
export async function createPullRequest(
  t: AzureTarget,
  input: CreatePullRequestInput,
): Promise<AzurePullRequestRef> {
  const url = withApiVersion(`${repoBase(t)}/pullrequests`);
  const created = await azureFetch<AzurePrRaw>(t.pat, url, {
    method: "POST",
    body: {
      sourceRefName: input.sourceRefName,
      targetRefName: input.targetRefName,
      title: input.title,
      description: input.description,
    },
  });
  return {
    pullRequestId: created.pullRequestId,
    title: created.title,
    status: created.status,
    sourceRefName: created.sourceRefName,
    targetRefName: created.targetRefName,
    createdBy: created.createdBy?.displayName ? { displayName: created.createdBy.displayName } : null,
    creationDate: created.creationDate,
  };
}
