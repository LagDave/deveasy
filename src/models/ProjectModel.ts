import type { Knex } from "knex";
import { db } from "../database/connection";
import { BaseModel } from "./BaseModel";

export interface IProject {
  id: number;
  name: string;
  path: string;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
}

const ACTIVE_PROJECT_KEY = "active_project_id";

/**
 * All DB access for projects and app settings (Constitution §7.4).
 */
export class ProjectModel extends BaseModel {
  protected static tableName = "projects";

  static async list(trx?: Knex.Transaction): Promise<IProject[]> {
    return this.table(trx).orderBy("name", "asc");
  }

  static async findById(id: number, trx?: Knex.Transaction): Promise<IProject | undefined> {
    return this.table(trx).where({ id }).first();
  }

  static async findByPath(p: string, trx?: Knex.Transaction): Promise<IProject | undefined> {
    return this.table(trx).where({ path: p }).first();
  }

  /** Insert a project if its path is new; returns the existing or created row. */
  static async upsertByPath(name: string, p: string, trx?: Knex.Transaction): Promise<IProject> {
    const [row] = await this.table(trx)
      .insert({ name, path: p })
      .onConflict("path")
      .merge({ name })
      .returning("*");
    return row as IProject;
  }

  /** Remove projects whose paths are no longer present on disk. */
  static async deleteByPaths(paths: string[], trx?: Knex.Transaction): Promise<void> {
    if (paths.length === 0) return;
    await this.table(trx).whereIn("path", paths).del();
  }

  static async touchOpened(id: number, trx?: Knex.Transaction): Promise<void> {
    await this.table(trx).where({ id }).update({ last_opened_at: db().fn.now() });
  }

  // --- app_settings: active project ---

  static async getActiveProjectId(trx?: Knex.Transaction): Promise<number | null> {
    const conn = trx ?? db();
    const row = await conn("app_settings").where({ key: ACTIVE_PROJECT_KEY }).first();
    return row?.value ? Number(row.value) : null;
  }

  static async setActiveProjectId(id: number, trx?: Knex.Transaction): Promise<void> {
    const conn = trx ?? db();
    await conn("app_settings")
      .insert({ key: ACTIVE_PROJECT_KEY, value: String(id) })
      .onConflict("key")
      .merge({ value: String(id), updated_at: db().fn.now() });
  }
}
