import { createReadStream } from "node:fs";
import type { Request, Response } from "express";
import { childLogger } from "../../lib/logger";
import { EditorService } from "./feature-services/EditorService";
import { EditorStateService } from "./feature-services/EditorStateService";
import { EditorError } from "./feature-utils/EditorError";
import { handleEditorError, ok } from "./feature-utils/controllerResponses";

const log = childLogger({ route: "editor" });

/** Parse a positive-int projectId from the query string, or throw a typed error. */
function requireProjectId(req: Request): number {
  const raw = Number((req.query.projectId as string | undefined) ?? "");
  if (!Number.isInteger(raw) || raw <= 0) {
    throw new EditorError("EDITOR_NO_ACTIVE_PROJECT", "A valid projectId query parameter is required.");
  }
  return raw;
}

/** Read a string `path` query param (empty string is allowed — it means the root). */
function pathQuery(req: Request): string {
  const raw = req.query.path;
  return typeof raw === "string" ? raw : "";
}

/**
 * Thin controller: validated input -> service -> shaped response. No business logic,
 * no DB access (Constitution §7.3). Mirrors GitController.
 */
export class EditorController {
  /** GET /api/editor/tree?projectId=&path= — one directory level. */
  static async getTree(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = requireProjectId(req);
      const entries = await EditorService.listDir(projectId, pathQuery(req));
      return ok(res, entries);
    } catch (error) {
      log.error({ err: error }, "editor tree failed");
      return handleEditorError(res, error);
    }
  }

  /** GET /api/editor/file?projectId=&path= — text file content. */
  static async getFile(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = requireProjectId(req);
      const file = await EditorService.readFile(projectId, pathQuery(req));
      return ok(res, file);
    } catch (error) {
      log.error({ err: error }, "editor file read failed");
      return handleEditorError(res, error);
    }
  }

  /** GET /api/editor/raw?projectId=&path= — streams bytes for images/PDF/HTML-as-page. */
  static async getRaw(req: Request, res: Response): Promise<Response | void> {
    try {
      const projectId = requireProjectId(req);
      const relPath = pathQuery(req);
      const stat = await EditorService.statForRaw(projectId, relPath);
      res.setHeader("Content-Type", stat.contentType);
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Content-Length", String(stat.size));
      // Stored-XSS hardening (§5.2, §5.4): files are user/Claude-authored and served
      // same-origin. `sandbox` makes any HTML/SVG navigated to here run with an opaque
      // origin and NO scripts, so it cannot reach app cookies/APIs; nosniff stops the
      // browser from re-interpreting a declared type. Images (<img>) and PDF (browser
      // viewer) still render — the directive only constrains document execution.
      res.setHeader("Content-Security-Policy", "sandbox");
      res.setHeader("X-Content-Type-Options", "nosniff");
      const stream = createReadStream(stat.absPath);
      stream.on("error", (err) => {
        log.error({ err, relPath }, "editor raw stream failed");
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            data: null,
            error: { code: "EDITOR_STREAM_FAILED", message: "Failed to stream the file.", details: null },
          });
        } else {
          res.destroy(err);
        }
      });
      stream.pipe(res);
    } catch (error) {
      log.error({ err: error }, "editor raw failed");
      return handleEditorError(res, error);
    }
  }

  /** POST /api/editor/file {projectId, path, content} — write a text file. */
  static async saveFile(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as { projectId?: unknown; path?: unknown; content?: unknown };
      const projectId = Number(body.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        throw new EditorError("EDITOR_NO_ACTIVE_PROJECT", "A valid projectId is required.");
      }
      if (typeof body.path !== "string" || body.path.length === 0) {
        throw new EditorError("EDITOR_PATH_FORBIDDEN", "A file path is required.");
      }
      if (typeof body.content !== "string") {
        throw new EditorError("EDITOR_INVALID_STATE", "content must be a string.");
      }
      const result = await EditorService.writeFile(projectId, body.path, body.content);
      return ok(res, result);
    } catch (error) {
      log.error({ err: error }, "editor file save failed");
      return handleEditorError(res, error);
    }
  }

  /** GET /api/editor/state?projectId= — persisted open tabs + active tab. */
  static async getState(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = requireProjectId(req);
      const state = await EditorStateService.getState(projectId);
      return ok(res, state);
    } catch (error) {
      log.error({ err: error }, "editor state read failed");
      return handleEditorError(res, error);
    }
  }

  /** PUT /api/editor/state {projectId, openPaths, activePath} — upsert tab state. */
  static async putState(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as {
        projectId?: unknown;
        openPaths?: unknown;
        activePath?: unknown;
      };
      const projectId = Number(body.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        throw new EditorError("EDITOR_NO_ACTIVE_PROJECT", "A valid projectId is required.");
      }
      const activePath = body.activePath === undefined ? null : body.activePath;
      const state = await EditorStateService.saveState(projectId, body.openPaths, activePath);
      return ok(res, state);
    } catch (error) {
      log.error({ err: error }, "editor state save failed");
      return handleEditorError(res, error);
    }
  }
}
