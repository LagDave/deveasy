import type { Request, Response } from "express";
import { childLogger } from "../../lib/logger";
import { AzurePullRequestService } from "./feature-services/AzurePullRequestService";
import { handleAzureError, ok } from "./feature-utils/controllerResponses";

const log = childLogger({ route: "azure" });

/**
 * Thin controller: validated input -> service -> shaped response. No business logic,
 * no DB access (Constitution §7.3). The PAT never appears in a response — only a
 * connected/expired status does.
 */
export class AzureController {
  /** GET /api/azure/status — connection state for the active project. */
  static async getStatus(_req: Request, res: Response): Promise<Response> {
    try {
      const state = await AzurePullRequestService.getStatus();
      return ok(res, state);
    } catch (error) {
      return handleAzureError(res, error);
    }
  }

  /** PUT /api/azure/connection — set the PAT + (org, project, repo) mapping. */
  static async connect(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const state = await AzurePullRequestService.connect({
        organization: String(body.organization ?? ""),
        project: String(body.project ?? ""),
        repository: String(body.repository ?? ""),
        pat: String(body.pat ?? ""),
      });
      // Deliberately never log the PAT — only the resulting status.
      log.info({ status: state.status }, "Azure connection updated");
      return ok(res, state);
    } catch (error) {
      return handleAzureError(res, error);
    }
  }

  /** GET /api/azure/pull-requests — list active PRs. */
  static async listPullRequests(_req: Request, res: Response): Promise<Response> {
    try {
      const pullRequests = await AzurePullRequestService.listPullRequests();
      return ok(res, { pullRequests });
    } catch (error) {
      return handleAzureError(res, error);
    }
  }

  /** GET /api/azure/pull-requests/:id — PR detail (status, votes, threads, files). */
  static async getPullRequestDetail(req: Request, res: Response): Promise<Response> {
    try {
      const id = Number(req.params.id);
      const detail = await AzurePullRequestService.getPullRequestDetail(id);
      return ok(res, detail);
    } catch (error) {
      return handleAzureError(res, error);
    }
  }

  /** POST /api/azure/pull-requests — create a new PR. */
  static async createPullRequest(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const created = await AzurePullRequestService.createPullRequest({
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
