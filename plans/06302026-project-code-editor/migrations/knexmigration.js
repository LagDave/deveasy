/**
 * Migration: create project_editor_state
 *
 * Persists which files are open in the in-app code editor, per project, so the
 * editor reopens where the operator left off after an app reload. Unsaved buffer
 * contents are NOT stored here — only the set/order of open tabs and the active one.
 *
 * One row per project (project_id UNIQUE). Cascade-deletes with the project.
 *
 * NOTE: DevEasy runs PostgreSQL via Knex. The real migration is authored during
 * execution as a TypeScript file in the project's migrations dir
 * (src/database/migrations/<timestamp>_create_project_editor_state.ts). This JS
 * file is the plan-folder scaffold of that migration's up/down.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  // TODO: fill during execution
  await knex.schema.createTable("project_editor_state", (t) => {
    t.increments("id").primary();
    t.integer("project_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    t.jsonb("open_paths").notNullable().defaultTo("[]"); // ordered relative paths
    t.text("active_path").nullable();
    t.timestamps(true, true); // created_at, updated_at with defaults
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  // TODO: fill during execution
  await knex.schema.dropTableIfExists("project_editor_state");
};
