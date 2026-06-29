import type { Knex } from "knex";
import { BaseModel } from "./BaseModel";

export type MessageRole = "user" | "assistant" | "system";

export interface ISessionMessage {
  id: number;
  session_id: number;
  role: MessageRole;
  event_type: string;
  content: unknown;
  created_at: string;
}

export interface CreateSessionMessageInput {
  sessionId: number;
  role: MessageRole;
  eventType: string;
  content: unknown;
}

/**
 * All DB access for the streamed transcript (Constitution §7.4). Each Claude
 * stream-json event and each user turn is persisted as one row.
 */
export class SessionMessageModel extends BaseModel {
  protected static tableName = "session_messages";

  static async create(
    input: CreateSessionMessageInput,
    trx?: Knex.Transaction,
  ): Promise<ISessionMessage> {
    const [row] = await this.table(trx)
      .insert({
        session_id: input.sessionId,
        role: input.role,
        event_type: input.eventType,
        content: JSON.stringify(input.content),
      })
      .returning("*");
    return row as ISessionMessage;
  }

  static async listBySession(
    sessionId: number,
    trx?: Knex.Transaction,
  ): Promise<ISessionMessage[]> {
    return this.table(trx).where({ session_id: sessionId }).orderBy("id", "asc");
  }
}
