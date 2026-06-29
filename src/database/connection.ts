import knex, { type Knex } from "knex";
import { loadConfig } from "../config";

/**
 * Central Knex instance. Connection pooling is managed here — never open or close
 * connections per query (Constitution §10.6).
 */
let instance: Knex | null = null;

export function db(): Knex {
  if (!instance) {
    instance = knex({
      client: "pg",
      connection: loadConfig().databaseUrl,
      pool: { min: 2, max: 10 },
    });
  }
  return instance;
}

export async function destroyDb(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}
