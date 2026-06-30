import type { Request, Response } from "express";
import { childLogger } from "../../lib/logger";
import { GitService } from "./feature-services/GitService";
import { GitError } from "./feature-utils/GitError";
import { handleGitError, ok } from "./feature-utils/controllerResponses";

const log = childLogger({ route: "git" });

/** Parse a positive-int projectId from the query string, or throw a typed error. */
function requireProjectId(req: Request): number {
  const raw = Number((req.query.projectId as string | undefined) ?? "");
  if (!Number.isInteger(raw) || raw <= 0) {
    throw new GitError("GIT_NO_ACTIVE_PROJECT", "A valid projectId query parameter is required.");
  }
  return raw;
}

/**
 * Thin controller: validated input -> service -> shaped response. No business logic,
 * no DB access (Constitution §7.3).
 */
export class GitController {
  /** GET /api/git/history?projectId= — commit log + branch for the chosen project. */
  static async history(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = requireProjectId(req);
      const rawLimit = Number((req.query.limit as string | undefined) ?? "");
      const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : undefined;
      const history = await GitService.getHistory(projectId, limit);
      return ok(res, history);
    } catch (error) {
      log.error({ err: error }, "git history failed");
      return handleGitError(res, error);
    }
  }

  /** GET /api/git/status?projectId= — working-tree status for the chosen project. */
  static async status(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = requireProjectId(req);
      const status = await GitService.getStatus(projectId);
      return ok(res, status);
    } catch (error) {
      log.error({ err: error }, "git status failed");
      return handleGitError(res, error);
    }
  }

  /** GET /api/git/branches?projectId= — local branches + current. */
  static async branches(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = requireProjectId(req);
      return ok(res, await GitService.getBranches(projectId));
    } catch (error) {
      log.error({ err: error }, "git branches failed");
      return handleGitError(res, error);
    }
  }

  /** POST /api/git/checkout { projectId, branch } — switch branches. */
  static async checkout(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as { projectId?: unknown; branch?: unknown };
      const projectId = Number(body.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        throw new GitError("GIT_NO_ACTIVE_PROJECT", "A valid projectId is required.");
      }
      const branch = typeof body.branch === "string" ? body.branch.trim() : "";
      if (!branch) throw new GitError("GIT_BRANCH_INVALID", "A branch name is required.");
      return ok(res, await GitService.checkout(projectId, branch));
    } catch (error) {
      log.error({ err: error }, "git checkout failed");
      return handleGitError(res, error);
    }
  }
}
