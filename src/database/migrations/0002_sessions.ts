import type { Knex } from "knex";

/**
 * Spec 2 schema: chat sessions against a project and the streamed transcript.
 * Only session/message rows live here — config (agents/skills/CLAUDE.md) is never
 * stored in the DB (Spec 1 boundary). The live CLI process is ephemeral; only the
 * transcript is persisted.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("sessions", (t) => {
    t.increments("id").primary();
    t.integer("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    t.string("title").nullable();
    t.string("status").notNullable().defaultTo("active");
    t.timestamps(true, true);
    t.index("project_id");
  });

  await knex.schema.createTable("session_messages", (t) => {
    t.increments("id").primary();
    t.integer("session_id").notNullable().references("id").inTable("sessions").onDelete("CASCADE");
    t.string("role").notNullable();
    t.string("event_type").notNullable();
    t.jsonb("content").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.index("session_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("session_messages");
  await knex.schema.dropTableIfExists("sessions");
}
