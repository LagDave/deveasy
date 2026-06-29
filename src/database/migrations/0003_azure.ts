import type { Knex } from "knex";

/**
 * Spec 3 schema: the Azure DevOps connection mapping. One row per project maps it
 * to an Azure (organization, project, repository). Secrets are NEVER stored here —
 * the PAT lives only in the OS keychain via SecretService (Constitution §5.1/§5.3).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("azure_connections", (t) => {
    t.increments("id").primary();
    t
      .integer("project_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    t.string("organization").notNullable();
    t.string("project").notNullable();
    t.string("repository").notNullable();
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("azure_connections");
}
