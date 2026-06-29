import type { Knex } from "knex";
import { BaseModel } from "./BaseModel";

export type SessionStatus = "active" | "closed";

export interface ISession {
  id: number;
  project_id: number;
  title: string | null;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

/**
 * All DB access for chat sessions (Constitution §7.4). Parameterized Knex only.
 */
export class SessionModel extends BaseModel {
  protected static tableName = "sessions";

  static async create(
    projectId: number,
    title: string | null,
    trx?: Knex.Transaction,
  ): Promise<ISession> {
    const [row] = await this.table(trx)
      .insert({ project_id: projectId, title, status: "active" })
      .returning("*");
    return row as ISession;
  }

  static async findById(id: number, trx?: Knex.Transaction): Promise<ISession | undefined> {
    return this.table(trx).where({ id }).first();
  }

  static async listByProject(projectId: number, trx?: Knex.Transaction): Promise<ISession[]> {
    return this.table(trx).where({ project_id: projectId }).orderBy("created_at", "desc");
  }

  /** Every session across all projects, newest first (for the grouped sidebar). */
  static async listAll(trx?: Knex.Transaction): Promise<ISession[]> {
    return this.table(trx).orderBy("created_at", "desc");
  }

  static async setStatus(
    id: number,
    status: SessionStatus,
    trx?: Knex.Transaction,
  ): Promise<void> {
    await this.table(trx).where({ id }).update({ status });
  }
}
