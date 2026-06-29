import type { Knex } from "knex";
import { BaseModel } from "./BaseModel";

export interface IAzureConnection {
  id: number;
  project_id: number;
  organization: string;
  project: string;
  repository: string;
  created_at: string;
  updated_at: string;
}

/** The (org, project, repo) mapping persisted for a connection upsert. No secrets. */
export interface IAzureConnectionInput {
  organization: string;
  project: string;
  repository: string;
}

/**
 * All DB access for the Azure connection mapping (Constitution §7.4). The PAT is
 * never stored here — only the non-secret org/project/repo mapping.
 */
export class AzureConnectionModel extends BaseModel {
  protected static tableName = "azure_connections";

  static async findByProjectId(
    projectId: number,
    trx?: Knex.Transaction,
  ): Promise<IAzureConnection | undefined> {
    return this.table(trx).where({ project_id: projectId }).first();
  }

  /** Insert or update the mapping for a project; returns the stored row. */
  static async upsertForProject(
    projectId: number,
    input: IAzureConnectionInput,
    trx?: Knex.Transaction,
  ): Promise<IAzureConnection> {
    const row = {
      project_id: projectId,
      organization: input.organization,
      project: input.project,
      repository: input.repository,
    };
    const [stored] = await this.table(trx)
      .insert(row)
      .onConflict("project_id")
      .merge({
        organization: input.organization,
        project: input.project,
        repository: input.repository,
      })
      .returning("*");
    return stored as IAzureConnection;
  }

  static async deleteByProjectId(projectId: number, trx?: Knex.Transaction): Promise<void> {
    await this.table(trx).where({ project_id: projectId }).del();
  }
}
