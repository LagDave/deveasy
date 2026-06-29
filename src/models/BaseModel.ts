import type { Knex } from "knex";
import { db } from "../database/connection";

/**
 * Thin base for models. ALL database access lives in models (Constitution §7.4);
 * controllers and services never call db() directly.
 */
export abstract class BaseModel {
  protected static tableName: string;

  protected static table(trx?: Knex.Transaction): Knex.QueryBuilder {
    const conn = trx ?? db();
    return conn(this.tableName);
  }
}
