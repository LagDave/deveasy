import type { Request, Response } from "express";
import { childLogger } from "../../lib/logger";
import { AzurePullRequestService } from "./feature-services/AzurePullRequestService";
import { AzureError } from "./feature-utils/AzureError";
import { handleAzureError, ok } from "./feature-utils/controllerResponses";

const log = childLogger({ route: "azure" });

/** Parse a positive-int projectId from query then body, or throw a typed error. */
function requireProjectId(value: unknown): number {
  const raw = Number(value ?? "");
  if (!Number.isInteger(raw) || raw <= 0) {
    throw new AzureError(
      "AZURE_NO_ACTIVE_PROJECT_NOT_FOUND",
      "A valid projectId is required.",
    );
  }
  return raw;
}

/**
 * Thin controller: validated input -> service -> shaped response. No business logic,
 * no DB access (Constitution §7.3). The PAT never appears in a response — only a
 * connected/expired status does.
 */
export class AzureController {
  /** GET /api/azure/status?projectId= — connection state for the chosen project. */
  static async getStatus(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = requireProjectId(req.query.projectId);
      const state = await AzurePullRequestService.getStatus(projectId);
      return ok(res, state);
    } catch (error) {
      return handleAzureError(res, error);
    }
  }

  /** PUT /api/azure/connection — set the PAT + (org, project, repo) mapping. */
  static async connect(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const projectId = requireProjectId(body.projectId ?? req.query.projectId);
      const state = await AzurePullRequestService.connect(projectId, {
        organization: String(body.organization ?? ""),
        project: String(body.project ?? ""),
        repository: String(body.repository ?? ""),
        pat: String(body.pat ?? ""),
      });
      // Deliberately never log the PAT — only the resulting status.
      log.info({ projectId, status: state.status }, "Azure connection updated");
      return ok(res, state);
    } catch (error) {
      return handleAzureError(res, error);
    }
  }

  /** GET /api/azure/pull-requests?projectId= — list active PRs. */
  static async listPullRequests(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = requireProjectId(req.query.projectId);
      const pullRequests = await AzurePullRequestService.listPullRequests(projectId);
      return ok(res, { pullRequests });
    } catch (error) {
      return handleAzureError(res, error);
    }
  }

  /** GET /api/azure/pull-requests/:id?projectId= — PR detail. */
  static async getPullRequestDetail(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = requireProjectId(req.query.projectId);
      const id = Number(req.params.id);
      const detail = await AzurePullRequestService.getPullRequestDetail(projectId, id);
      return ok(res, detail);
    } catch (error) {
      return handleAzureError(res, error);
    }
  }

  /** POST /api/azure/pull-requests — create a new PR. */
  static async createPullRequest(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const projectId = requireProjectId(body.projectId ?? req.query.projectId);
      const created = await AzurePullRequestService.createPullRequest(projectId, {
        sourceRefName: String(body.sourceRefName ?? ""),
        targetRefName: String(body.targetRefName ?? ""),
        title: String(body.title ?? ""),
        description: String(body.description ?? ""),
      });
      return ok(res, created, 201);
    } catch (error) {
      return handleAzureError(res, error);
    }
  }
}
