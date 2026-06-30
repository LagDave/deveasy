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

/** Parse a positive-int projectId from a JSON body, or throw a typed error. */
function requireProjectIdFromBody(body: { projectId?: unknown }): number {
  const raw = Number(body.projectId);
  if (!Number.isInteger(raw) || raw <= 0) {
    throw new GitError("GIT_NO_ACTIVE_PROJECT", "A valid projectId is required.");
  }
  return raw;
}

/** Coerce a body value into a string[] of paths (rejects non-arrays). */
function readPaths(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((p): p is string => typeof p === "string") : [];
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

  /** POST /api/git/stage { projectId, paths } — stage the given paths. */
  static async stage(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as { projectId?: unknown; paths?: unknown };
      const projectId = requireProjectIdFromBody(body);
      return ok(res, await GitService.stage(projectId, readPaths(body.paths)));
    } catch (error) {
      log.error({ err: error }, "git stage failed");
      return handleGitError(res, error);
    }
  }

  /** POST /api/git/unstage { projectId, paths } — unstage the given paths. */
  static async unstage(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as { projectId?: unknown; paths?: unknown };
      const projectId = requireProjectIdFromBody(body);
      return ok(res, await GitService.unstage(projectId, readPaths(body.paths)));
    } catch (error) {
      log.error({ err: error }, "git unstage failed");
      return handleGitError(res, error);
    }
  }

  /** POST /api/git/commit { projectId, message } — commit staged changes. */
  static async commit(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as { projectId?: unknown; message?: unknown };
      const projectId = requireProjectIdFromBody(body);
      const message = typeof body.message === "string" ? body.message : "";
      return ok(res, await GitService.commit(projectId, message));
    } catch (error) {
      log.error({ err: error }, "git commit failed");
      return handleGitError(res, error);
    }
  }

  /** POST /api/git/branch { projectId, name } — create and switch to a branch. */
  static async branch(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as { projectId?: unknown; name?: unknown };
      const projectId = requireProjectIdFromBody(body);
      const name = typeof body.name === "string" ? body.name : "";
      return ok(res, await GitService.createBranch(projectId, name), 201);
    } catch (error) {
      log.error({ err: error }, "git branch create failed");
      return handleGitError(res, error);
    }
  }

  /** POST /api/git/push { projectId } — push the current branch. */
  static async push(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = requireProjectIdFromBody((req.body ?? {}) as { projectId?: unknown });
      return ok(res, await GitService.push(projectId));
    } catch (error) {
      log.error({ err: error }, "git push failed");
      return handleGitError(res, error);
    }
  }

  /** POST /api/git/merge-main { projectId } — merge the current branch into main and push. */
  static async mergeMain(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = requireProjectIdFromBody((req.body ?? {}) as { projectId?: unknown });
      return ok(res, await GitService.mergeToMain(projectId));
    } catch (error) {
      log.error({ err: error }, "git merge-main failed");
      return handleGitError(res, error);
    }
  }
}
