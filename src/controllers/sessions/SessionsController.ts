import type { Request, Response } from "express";
import { childLogger } from "../../lib/logger";
import { ProjectModel } from "../../models/ProjectModel";
import { SessionMessageModel } from "../../models/SessionMessageModel";
import { SessionModel } from "../../models/SessionModel";
import { BrowserProcessService } from "../../services/BrowserProcessService";
import { ConfigInjectionService } from "../../services/ConfigInjectionService";
import { TerminalProcessService } from "../../services/TerminalProcessService";
import { SessionStreamService } from "./feature-services/SessionStreamService";
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
      const body = (req.body ?? {}) as {
        projectId?: unknown;
        title?: unknown;
        model?: unknown;
        effort?: unknown;
      };
      const projectId = Number(body.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        throw new SessionError("SESSION_INPUT_INVALID", "A valid projectId is required.");
      }
      const title = typeof body.title === "string" ? body.title : null;
      const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : null;
      const effort = typeof body.effort === "string" && body.effort.trim() ? body.effort.trim() : null;

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

      const session = await SessionModel.create(projectId, title, model, effort);
      log.info({ sessionId: session.id, projectId, model, effort }, "Session created");
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

      const states = SessionStreamService.getRuntimeStates();
      const annotated = sessions.map((s) => ({ ...s, runtime: states.get(s.id) ?? null }));
      return ok(res, { sessions: annotated });
    } catch (error) {
      return handleSessionError(res, error);
    }
  }

  /** POST /api/sessions/:id/stop — explicitly end a session's CLI process. */
  static async stop(req: Request, res: Response): Promise<Response> {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        throw new SessionError("SESSION_INPUT_INVALID", "A valid session id is required.");
      }
      SessionStreamService.stop(sessionId);
      log.info({ sessionId }, "Session stopped");
      return ok(res, { sessionId });
    } catch (error) {
      return handleSessionError(res, error);
    }
  }

  /** PATCH /api/sessions/:id { title } — rename a session. */
  static async rename(req: Request, res: Response): Promise<Response> {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        throw new SessionError("SESSION_INPUT_INVALID", "A valid session id is required.");
      }
      const title = String((req.body ?? {}).title ?? "").trim();
      if (!title || title.length > 80) {
        throw new SessionError("SESSION_INPUT_INVALID", "Title must be 1–80 characters.");
      }
      const session = await SessionModel.findById(sessionId);
      if (!session) throw new SessionError("SESSION_NOT_FOUND", "Session not found.", { sessionId });

      await SessionModel.updateTitle(sessionId, title);
      return ok(res, { sessionId, title });
    } catch (error) {
      return handleSessionError(res, error);
    }
  }

  /** DELETE /api/sessions/:id — stop the process (if live) and delete the session. */
  static async remove(req: Request, res: Response): Promise<Response> {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        throw new SessionError("SESSION_INPUT_INVALID", "A valid session id is required.");
      }
      SessionStreamService.stop(sessionId); // no-op if not live
      await SessionModel.delete(sessionId); // session_messages cascade
      await BrowserProcessService.closeAndWipe(sessionId); // close + wipe the session's browser profile; no-op if none
      TerminalProcessService.closeForSession(sessionId); // kill the session's terminals; no-op if none
      log.info({ sessionId }, "Session deleted");
      return ok(res, { sessionId });
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
