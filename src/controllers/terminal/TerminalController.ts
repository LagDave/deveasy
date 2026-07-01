import type { Request, Response } from "express";
import { childLogger } from "../../lib/logger";
import { TerminalError, TerminalProcessService } from "../../services/TerminalProcessService";
import { handleTerminalError, ok } from "./feature-utils/controllerResponses";

const log = childLogger({ route: "terminal" });

/** Parse a positive-int projectId from the query string, or throw a typed error. */
function requireProjectIdFromQuery(req: Request): number {
  const raw = Number((req.query.projectId as string | undefined) ?? "");
  if (!Number.isInteger(raw) || raw <= 0) {
    throw new TerminalError("TERMINAL_NO_PROJECT", "A valid projectId query parameter is required.");
  }
  return raw;
}

/**
 * Thin controller: validated input -> service -> shaped response (§7.3). The PTY
 * stream itself flows over the /ws/terminal WebSocket, not here — these endpoints
 * only create, list, and kill terminals.
 */
export class TerminalController {
  /**
   * POST /api/terminal { projectId, sessionId? } — spawn a PTY in the project cwd.
   * Pass a sessionId to make it a session terminal (shown in the session pane +
   * closed on session delete); omit it for a plain project terminal.
   */
  static async create(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as { projectId?: unknown; sessionId?: unknown };
      const projectId = Number(body.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        throw new TerminalError("TERMINAL_NO_PROJECT", "A valid projectId is required.");
      }
      let sessionId: number | null = null;
      if (body.sessionId !== undefined && body.sessionId !== null) {
        sessionId = Number(body.sessionId);
        if (!Number.isInteger(sessionId) || sessionId <= 0) {
          throw new TerminalError("TERMINAL_INPUT_INVALID", "sessionId must be a positive integer.");
        }
      }
      return ok(res, await TerminalProcessService.create(projectId, sessionId), 201);
    } catch (error) {
      log.error({ err: error }, "terminal create failed");
      return handleTerminalError(res, error);
    }
  }

  /**
   * GET /api/terminal?projectId= — list live terminals for the project.
   * GET /api/terminal?sessionId= — list live terminals owned by a session.
   */
  static async list(req: Request, res: Response): Promise<Response> {
    try {
      if (req.query.sessionId !== undefined) {
        const sessionId = Number(req.query.sessionId);
        if (!Number.isInteger(sessionId) || sessionId <= 0) {
          throw new TerminalError("TERMINAL_INPUT_INVALID", "A valid sessionId query parameter is required.");
        }
        return ok(res, { terminals: TerminalProcessService.listBySession(sessionId) });
      }
      const projectId = requireProjectIdFromQuery(req);
      return ok(res, { terminals: TerminalProcessService.list(projectId) });
    } catch (error) {
      log.error({ err: error }, "terminal list failed");
      return handleTerminalError(res, error);
    }
  }

  /** DELETE /api/terminal/:id — kill a terminal. */
  static async remove(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id;
      if (!id) throw new TerminalError("TERMINAL_NOT_FOUND", "A terminal id is required.");
      TerminalProcessService.kill(id);
      return ok(res, { ok: true });
    } catch (error) {
      log.error({ err: error }, "terminal remove failed");
      return handleTerminalError(res, error);
    }
  }
}
