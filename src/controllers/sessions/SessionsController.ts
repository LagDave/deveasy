import type { Request, Response } from "express";
import { childLogger } from "../../lib/logger";
import { ProjectModel } from "../../models/ProjectModel";
import { SessionMessageModel } from "../../models/SessionMessageModel";
import { SessionModel } from "../../models/SessionModel";
import { ClaudeProcessService } from "../../services/ClaudeProcessService";
import { ConfigInjectionService } from "../../services/ConfigInjectionService";
import { handleSessionError, ok } from "./feature-utils/controllerResponses";
import { SessionError } from "./feature-utils/SessionError";

const log = childLogger({ route: "sessions" });

/**
 * Thin controller: validated input -> models -> shaped response. No business
 * logic, no DB access beyond model calls (Constitution §7.3).
 */
export class SessionsController {
  /** POST /api/sessions { projectId, title? } — create a session for a project. */
  static async create(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as { projectId?: unknown; title?: unknown };
      const projectId = Number(body.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        throw new SessionError("SESSION_INPUT_INVALID", "A valid projectId is required.");
      }
      const title = typeof body.title === "string" ? body.title : null;

      const project = await ProjectModel.findById(projectId);
      if (!project) {
        throw new SessionError("PROJECT_NOT_FOUND", "Project not found.", { projectId });
      }

      // Starting a session in a project no longer requires making it the active
      // project first, so ensure the shared config is injected here. Best-effort:
      // if the project has its own config (CONFIG_INJECTION_CONFLICT), its config
      // wins and we proceed rather than blocking the session.
      try {
        await ConfigInjectionService.inject(project.path);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "CONFIG_INJECTION_CONFLICT") throw err;
        log.warn({ projectId, path: project.path }, "Project has its own config; skipped injection");
      }

      const session = await SessionModel.create(projectId, title);
      log.info({ sessionId: session.id, projectId }, "Session created");
      return ok(res, { session }, 201);
    } catch (error) {
      return handleSessionError(res, error);
    }
  }

  /**
   * GET /api/sessions[?projectId=] — list sessions (all projects, or one), each
   * annotated with `isLive` so the sidebar can show a running indicator.
   */
  static async list(req: Request, res: Response): Promise<Response> {
    try {
      const hasFilter = req.query.projectId !== undefined;
      let sessions;
      if (hasFilter) {
        const projectId = Number(req.query.projectId);
        if (!Number.isInteger(projectId) || projectId <= 0) {
          throw new SessionError("SESSION_INPUT_INVALID", "A valid projectId query param is required.");
        }
        sessions = await SessionModel.listByProject(projectId);
      } else {
        sessions = await SessionModel.listAll();
      }

      const liveIds = new Set(ClaudeProcessService.getLiveSessionIds());
      const annotated = sessions.map((s) => ({ ...s, isLive: liveIds.has(s.id) }));
      return ok(res, { sessions: annotated });
    } catch (error) {
      return handleSessionError(res, error);
    }
  }

  /** GET /api/sessions/:id/messages — the persisted transcript for a session. */
  static async listMessages(req: Request, res: Response): Promise<Response> {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        throw new SessionError("SESSION_INPUT_INVALID", "A valid session id is required.");
      }
      const session = await SessionModel.findById(sessionId);
      if (!session) {
        throw new SessionError("SESSION_NOT_FOUND", "Session not found.", { sessionId });
      }
      const messages = await SessionMessageModel.listBySession(sessionId);
      return ok(res, { messages });
    } catch (error) {
      return handleSessionError(res, error);
    }
  }
}
