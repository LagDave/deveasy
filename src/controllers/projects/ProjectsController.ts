import type { Request, Response } from "express";
import { ProjectCreateService } from "./feature-services/ProjectCreateService";
import { ProjectScanService } from "./feature-services/ProjectScanService";
import { handleProjectError, ok } from "./feature-utils/controllerResponses";
import { ProjectError } from "./feature-utils/ProjectError";

/**
 * Thin controller: validated input -> services -> shaped response. No business
 * logic, no DB access (Constitution §7.3).
 */
export class ProjectsController {
  /** GET /api/projects — scan disk, reconcile, return the registry. */
  static async list(_req: Request, res: Response): Promise<Response> {
    try {
      const projects = await ProjectScanService.sync();
      return ok(res, { projects });
    } catch (error) {
      return handleProjectError(res, error);
    }
  }

  /** POST /api/projects — create a new project + opening session, return both. */
  static async create(req: Request, res: Response): Promise<Response> {
    try {
      const name = (req.body as { name?: unknown } | undefined)?.name;
      if (typeof name !== "string" || name.trim().length === 0) {
        // §11.2 — validate at the boundary before reaching the service.
        throw new ProjectError("PROJECT_NAME_INVALID", "A non-empty project name is required.");
      }
      const result = await ProjectCreateService.create(name.trim());
      return ok(res, result, 201);
    } catch (error) {
      return handleProjectError(res, error);
    }
  }
}
