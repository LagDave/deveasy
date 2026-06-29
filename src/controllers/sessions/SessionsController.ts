import type { Request, Response } from "express";
import { childLogger } from "../../lib/logger";
import { ProjectModel } from "../../models/ProjectModel";
import { SessionMessageModel } from "../../models/SessionMessageModel";
import { SessionModel } from "../../models/SessionModel";
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

      const session = await SessionModel.create(projectId, title);
      log.info({ sessionId: session.id, projectId }, "Session created");
      return ok(res, { session }, 201);
    } catch (error) {
      return handleSessionError(res, error);
    }
  }

  /** GET /api/sessions?projectId= — list sessions for a project. */
  static async list(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = Number(req.query.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        throw new SessionError("SESSION_INPUT_INVALID", "A valid projectId query param is required.");
      }
      const sessions = await SessionModel.listByProject(projectId);
      return ok(res, { sessions });
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
