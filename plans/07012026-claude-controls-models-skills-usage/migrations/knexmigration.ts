import type { Knex } from "knex";

/**
 * Plan 07012026 — Claude Controls.
 * Adds per-session model selection and the CLI's own session id (so a model
 * switch can restart the process with --resume and preserve context).
 *
 * Real target on execution: src/database/migrations/0005_session_model.ts
 * (mirrors 0002_sessions.ts). DevEasy is Postgres-only, so there is no
 * mssql.sql in this folder — pgsql.sql is the reference DDL.
 *
 * -- TODO on execution: confirm the next migration index is 0005 and rename.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("sessions", (t) => {
    // CLI model alias or full name (null = CLI default).
    t.string("model").nullable();
    // The CLI's own session uuid (from the init event) — used for --resume.
    t.string("cli_session_id").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("sessions", (t) => {
    t.dropColumn("cli_session_id");
    t.dropColumn("model");
  });
}
