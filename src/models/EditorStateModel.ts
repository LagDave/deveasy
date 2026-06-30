import type { Knex } from "knex";
import { db } from "../database/connection";
import { BaseModel } from "./BaseModel";

export interface IProjectEditorState {
  id: number;
  project_id: number;
  /** Ordered relative paths of the open tabs. JSONB column. */
  open_paths: string[];
  active_path: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * All DB access for persisted editor tab state (Constitution §7.4). Stores only
 * which files are open per project, never unsaved buffer contents.
 */
export class EditorStateModel extends BaseModel {
  protected static tableName = "project_editor_state";

  /** The saved state for a project, or null when none has been persisted yet. */
  static async getByProjectId(
    projectId: number,
    trx?: Knex.Transaction,
  ): Promise<IProjectEditorState | null> {
    const row = await this.table(trx).where({ project_id: projectId }).first();
    return (row as IProjectEditorState | undefined) ?? null;
  }

  /** Insert or update the single state row for a project; returns the saved row. */
  static async upsert(
    projectId: number,
    openPaths: string[],
    activePath: string | null,
    trx?: Knex.Transaction,
  ): Promise<IProjectEditorState> {
    const [row] = await this.table(trx)
      .insert({
        project_id: projectId,
        open_paths: JSON.stringify(openPaths),
        active_path: activePath,
        updated_at: db().fn.now(),
      })
      .onConflict("project_id")
      .merge({
        open_paths: JSON.stringify(openPaths),
        active_path: activePath,
        updated_at: db().fn.now(),
      })
      .returning("*");
    return row as IProjectEditorState;
  }
}
