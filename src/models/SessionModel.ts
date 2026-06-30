import type { Knex } from "knex";
import { BaseModel } from "./BaseModel";

export type SessionStatus = "active" | "closed";

export interface ISession {
  id: number;
  project_id: number;
  title: string | null;
  status: SessionStatus;
  /** Claude model alias/full name for this session; null = CLI default. */
  model: string | null;
  /** The CLI's own session uuid (from the init event), used for --resume. */
  cli_session_id: string | null;
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
    model: string | null = null,
    trx?: Knex.Transaction,
  ): Promise<ISession> {
    const [row] = await this.table(trx)
      .insert({ project_id: projectId, title, status: "active", model })
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

  static async updateTitle(id: number, title: string, trx?: Knex.Transaction): Promise<void> {
    await this.table(trx).where({ id }).update({ title });
  }

  /** Set the session's selected model (null restores the CLI default). */
  static async setModel(id: number, model: string | null, trx?: Knex.Transaction): Promise<void> {
    await this.table(trx).where({ id }).update({ model });
  }

  /** Persist the CLI's own session uuid so a model switch can --resume it. */
  static async setCliSessionId(
    id: number,
    cliSessionId: string,
    trx?: Knex.Transaction,
  ): Promise<void> {
    await this.table(trx).where({ id }).update({ cli_session_id: cliSessionId });
  }

  /** Delete a session; session_messages cascade via the FK (migration 0002). */
  static async delete(id: number, trx?: Knex.Transaction): Promise<void> {
    await this.table(trx).where({ id }).del();
  }
}
