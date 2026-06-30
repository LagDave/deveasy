import type { Knex } from "knex";

/**
 * Spec 4 schema: persisted code-editor tab state, one row per project. Stores only
 * which files are open (ordered relative paths) and which is active — NEVER the
 * unsaved buffer contents (those stay on disk / in the UI). The PK + unique
 * project_id let EditorStateModel upsert with onConflict('project_id').merge.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("project_editor_state", (t) => {
    t.increments("id").primary();
    t
      .integer("project_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    t.jsonb("open_paths").notNullable().defaultTo("[]");
    t.text("active_path").nullable();
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("project_editor_state");
}
