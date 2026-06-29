import type { Knex } from "knex";

/**
 * Foundation schema (Spec 1): the project registry and a key/value app-settings
 * table that holds the active project. Config (agents/skills/CLAUDE.md) is NEVER
 * stored here — it lives as version-controlled files.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("projects", (t) => {
    t.increments("id").primary();
    t.string("name").notNullable();
    t.string("path").notNullable().unique();
    t.timestamp("last_opened_at").nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("app_settings", (t) => {
    t.string("key").primary();
    t.text("value").nullable();
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("app_settings");
  await knex.schema.dropTableIfExists("projects");
}
