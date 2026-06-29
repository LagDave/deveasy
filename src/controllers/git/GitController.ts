import type { Request, Response } from "express";
import { childLogger } from "../../lib/logger";
import { GitService } from "./feature-services/GitService";
import { handleGitError, ok } from "./feature-utils/controllerResponses";

const log = childLogger({ route: "git" });

/**
 * Thin controller: validated input -> service -> shaped response. No business logic,
 * no DB access (Constitution §7.3).
 */
export class GitController {
  /** GET /api/git/history — commit log + branch for the active project. */
  static async history(req: Request, res: Response): Promise<Response> {
    try {
      const rawLimit = Number((req.query.limit as string | undefined) ?? "");
      const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : undefined;
      const history = await GitService.getHistory(limit);
      return ok(res, history);
    } catch (error) {
      log.error({ err: error }, "git history failed");
      return handleGitError(res, error);
    }
  }

  /** GET /api/git/status — working-tree status for the active project. */
  static async status(_req: Request, res: Response): Promise<Response> {
    try {
      const status = await GitService.getStatus();
      return ok(res, status);
    } catch (error) {
      log.error({ err: error }, "git status failed");
      return handleGitError(res, error);
    }
  }
}
