import { childLogger } from "../../../lib/logger";
import {
  AzureAuthError,
  createPullRequest,
  getPullRequestDetail,
  listPullRequests,
  type AzurePullRequestDetail,
  type AzurePullRequestRef,
  type AzureTarget,
  type CreatePullRequestInput,
} from "../../../lib/azureClient";
import {
  AzureConnectionModel,
  type IAzureConnection,
  type IAzureConnectionInput,
} from "../../../models/AzureConnectionModel";
import { SecretService } from "../../../services/SecretService";
import { AZURE_RECONNECT_REQUIRED, AzureError } from "../feature-utils/AzureError";

const log = childLogger({ module: "AzurePullRequestService" });

/** Connection status surfaced to the frontend — never the PAT itself (§5.1/§5.3). */
export type AzureConnectionStatus = "connected" | "expired" | "disconnected" | "unmapped";

export interface AzureConnectionState {
  status: AzureConnectionStatus;
  organization: string | null;
  project: string | null;
  repository: string | null;
}

/**
 * Business logic for the Azure PR surface (Constitution §7.1). Reads the project→
 * (org, project, repo) mapping from the model and the PAT from SecretService, then
 * delegates HTTP to azureClient. The PAT never leaves this layer except as the
 * AzureTarget passed into the client; it is never logged or returned to a caller.
 */
export class AzurePullRequestService {
  /** Validate a caller-supplied projectId, or raise a typed error. */
  private static requireProjectId(projectId: number): number {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new AzureError("AZURE_NO_ACTIVE_PROJECT_NOT_FOUND", "A valid projectId is required.");
    }
    return projectId;
  }

  private static async getConnectionOrThrow(projectId: number): Promise<IAzureConnection> {
    const conn = await AzureConnectionModel.findByProjectId(projectId);
    if (!conn) {
      throw new AzureError(
        "AZURE_NOT_CONNECTED_NOT_FOUND",
        "No Azure repository is mapped to this project.",
        { projectId },
      );
    }
    return conn;
  }

  /** Build an AzureTarget (mapping + PAT) or raise a reconnect error if no PAT. */
  private static async buildTarget(conn: IAzureConnection): Promise<AzureTarget> {
    const pat = await SecretService.getAzurePat(conn.organization);
    if (!pat) {
      throw new AzureError(
        AZURE_RECONNECT_REQUIRED,
        "No Azure PAT is stored. Reconnect to continue.",
        { organization: conn.organization },
      );
    }
    return {
      organization: conn.organization,
      project: conn.project,
      repository: conn.repository,
      pat,
    };
  }

  /** Translate an Azure 401/403 into the typed reconnect error (§8.4). */
  private static toReconnect(error: unknown, organization: string): never {
    if (error instanceof AzureAuthError) {
      throw new AzureError(AZURE_RECONNECT_REQUIRED, "Azure PAT is invalid or expired. Reconnect to continue.", {
        organization,
      });
    }
    throw error;
  }

  /** Persist the PAT (keychain) + mapping (DB) and return a connected status. */
  static async connect(
    projectId: number,
    input: IAzureConnectionInput & { pat: string },
  ): Promise<AzureConnectionState> {
    const org = input.organization?.trim();
    const project = input.project?.trim();
    const repository = input.repository?.trim();
    const pat = input.pat?.trim();
    if (!org || !project || !repository || !pat) {
      throw new AzureError(
        "AZURE_INPUT_INVALID",
        "organization, project, repository, and a PAT are all required.",
      );
    }

    const id = AzurePullRequestService.requireProjectId(projectId);
    await SecretService.setAzurePat(org, pat);
    await AzureConnectionModel.upsertForProject(id, {
      organization: org,
      project,
      repository,
    });
    log.info({ projectId: id, organization: org }, "Azure connection saved");

    return AzurePullRequestService.getStatus(id);
  }

  /** Connected/expired/disconnected/unmapped status — never exposes the PAT. */
  static async getStatus(projectId: number): Promise<AzureConnectionState> {
    const id = AzurePullRequestService.requireProjectId(projectId);
    const conn = await AzureConnectionModel.findByProjectId(id);
    if (!conn) {
      return { status: "unmapped", organization: null, project: null, repository: null };
    }
    const pat = await SecretService.getAzurePat(conn.organization);
    const base = {
      organization: conn.organization,
      project: conn.project,
      repository: conn.repository,
    };
    if (!pat) return { status: "disconnected", ...base };

    // Probe lightly: a failed list call with auth error means the PAT expired.
    try {
      await listPullRequests({ ...base, pat });
      return { status: "connected", ...base };
    } catch (error) {
      if (error instanceof AzureAuthError) return { status: "expired", ...base };
      // A non-auth failure should not masquerade as expiry; report connected mapping.
      log.warn({ projectId, err: error }, "Azure status probe failed (non-auth)");
      return { status: "connected", ...base };
    }
  }

  static async listPullRequests(projectId: number): Promise<AzurePullRequestRef[]> {
    const id = AzurePullRequestService.requireProjectId(projectId);
    const conn = await AzurePullRequestService.getConnectionOrThrow(id);
    const target = await AzurePullRequestService.buildTarget(conn);
    try {
      return await listPullRequests(target);
    } catch (error) {
      return AzurePullRequestService.toReconnect(error, conn.organization);
    }
  }

  static async getPullRequestDetail(
    projectId: number,
    pullRequestId: number,
  ): Promise<AzurePullRequestDetail> {
    if (!Number.isInteger(pullRequestId) || pullRequestId <= 0) {
      throw new AzureError("AZURE_INPUT_INVALID", "A valid pullRequestId is required.");
    }
    const id = AzurePullRequestService.requireProjectId(projectId);
    const conn = await AzurePullRequestService.getConnectionOrThrow(id);
    const target = await AzurePullRequestService.buildTarget(conn);
    try {
      return await getPullRequestDetail(target, pullRequestId);
    } catch (error) {
      return AzurePullRequestService.toReconnect(error, conn.organization);
    }
  }

  static async createPullRequest(
    projectId: number,
    input: CreatePullRequestInput,
  ): Promise<AzurePullRequestRef> {
    const source = input.sourceRefName?.trim();
    const target = input.targetRefName?.trim();
    const title = input.title?.trim();
    if (!source || !target || !title) {
      throw new AzureError(
        "AZURE_INPUT_INVALID",
        "sourceRefName, targetRefName, and title are required.",
      );
    }
    const id = AzurePullRequestService.requireProjectId(projectId);
    const conn = await AzurePullRequestService.getConnectionOrThrow(id);
    const azureTarget = await AzurePullRequestService.buildTarget(conn);
    try {
      return await createPullRequest(azureTarget, {
        sourceRefName: AzurePullRequestService.normalizeRef(source),
        targetRefName: AzurePullRequestService.normalizeRef(target),
        title,
        description: input.description?.trim() ?? "",
      });
    } catch (error) {
      return AzurePullRequestService.toReconnect(error, conn.organization);
    }
  }

  /** Azure wants full ref names; accept either `main` or `refs/heads/main`. */
  private static normalizeRef(ref: string): string {
    return ref.startsWith("refs/heads/") ? ref : `refs/heads/${ref}`;
  }
}
