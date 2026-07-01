import type { Knex } from "knex";

/**
 * Plan 07012026 (Rev 8) — per-session thinking effort. Nullable; null = the CLI's
 * configured default (settings.json effortLevel). Set at spawn via `--effort` and
 * switchable mid-session like the model.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("sessions", (t) => {
    t.string("effort").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("sessions", (t) => {
    t.dropColumn("effort");
  });
}
