import { EditorStateModel } from "../../../models/EditorStateModel";
import { EditorError } from "../feature-utils/EditorError";
import { assertRelativePathShape } from "../feature-utils/fileSafety";
import { ProjectModel } from "../../../models/ProjectModel";

export interface EditorState {
  openPaths: string[];
  activePath: string | null;
}

/**
 * Persisted editor tab state per project. Stores only which files are open, never
 * unsaved buffer contents. All DB access goes through EditorStateModel (§7.4); the
 * project root is resolved via ProjectModel so saved paths can be guard-validated
 * (defense in depth, §5.2).
 */
export class EditorStateService {
  private static async resolveProjectRoot(projectId: number): Promise<string> {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new EditorError("EDITOR_NO_ACTIVE_PROJECT", "A valid projectId is required.");
    }
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new EditorError("EDITOR_PROJECT_NOT_FOUND", "Project not found.", { projectId });
    }
    return project.path;
  }

  /** Saved tab state for a project; empty default when none has been persisted. */
  static async getState(projectId: number): Promise<EditorState> {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new EditorError("EDITOR_NO_ACTIVE_PROJECT", "A valid projectId is required.");
    }
    const row = await EditorStateModel.getByProjectId(projectId);
    if (!row) return { openPaths: [], activePath: null };
    return {
      openPaths: Array.isArray(row.open_paths) ? row.open_paths : [],
      activePath: row.active_path,
    };
  }

  /** Upsert the tab state; validates the shape of every persisted path before storing. */
  static async saveState(
    projectId: number,
    openPaths: unknown,
    activePath: unknown,
  ): Promise<EditorState> {
    // Confirms the project exists (throws if not); the path itself isn't needed here.
    await EditorStateService.resolveProjectRoot(projectId);

    if (!Array.isArray(openPaths) || !openPaths.every((p): p is string => typeof p === "string")) {
      throw new EditorError("EDITOR_INVALID_STATE", "openPaths must be an array of strings.");
    }
    if (activePath !== null && typeof activePath !== "string") {
      throw new EditorError("EDITOR_INVALID_STATE", "activePath must be a string or null.");
    }

    // Persisted paths are UI bookmarks: validate their shape (no absolute/.. ) but do
    // NOT realpath-resolve — a symlinked open tab (e.g. injected CLAUDE.md) must not
    // hard-fail persistence. The full filesystem guard still runs at read/write time.
    for (const p of openPaths) {
      assertRelativePathShape(p);
    }
    if (typeof activePath === "string" && activePath.length > 0) {
      assertRelativePathShape(activePath);
    }

    const row = await EditorStateModel.upsert(projectId, openPaths, activePath as string | null);
    return {
      openPaths: Array.isArray(row.open_paths) ? row.open_paths : [],
      activePath: row.active_path,
    };
  }
}
