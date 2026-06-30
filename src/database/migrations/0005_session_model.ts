import type { Knex } from "knex";

/**
 * Plan 07012026 — Claude Controls. Per-session model selection and the CLI's own
 * session id. The model lets the operator pick (and switch) the Claude model for a
 * session; cli_session_id is captured from the CLI `init` event so a model switch
 * can restart the process with `--resume` and preserve conversation context.
 * Both nullable — null model means the CLI default.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("sessions", (t) => {
    t.string("model").nullable();
    t.string("cli_session_id").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("sessions", (t) => {
    t.dropColumn("cli_session_id");
    t.dropColumn("model");
  });
}
