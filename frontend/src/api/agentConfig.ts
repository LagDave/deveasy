import { apiDelete, apiGet, apiPut } from "./index";

/**
 * Thin typed functions over the HTTP client — one file per backend domain (§12.1).
 * Types live here (this slice owns its contract; shared types/index.ts is untouched).
 */

export type ConfigType = "agent" | "skill" | "claudemd";

/** Frontmatter is an open string/unknown map; never `any` (§17.2). */
export type Frontmatter = Record<string, unknown>;

export interface ConfigSummary {
  type: ConfigType;
  name: string;
  title: string | null;
  description: string | null;
}

export interface ConfigDocument extends ConfigSummary {
  frontmatter: Frontmatter;
  body: string;
}

export interface ConfigListing {
  agents: ConfigSummary[];
  skills: ConfigSummary[];
  claudemd: ConfigSummary | null;
}

export interface ConfigWriteInput {
  frontmatter: Frontmatter;
  body: string;
}

export async function getAgentConfig(): Promise<ConfigListing> {
  return apiGet<ConfigListing>("/api/agent-config");
}

export async function getConfigDocument(type: ConfigType, name: string): Promise<ConfigDocument> {
  const data = await apiGet<{ document: ConfigDocument }>(
    `/api/agent-config/${type}/${encodeURIComponent(name)}`,
  );
  return data.document;
}

export async function saveConfigDocument(
  type: ConfigType,
  name: string,
  input: ConfigWriteInput,
): Promise<ConfigDocument> {
  const data = await apiPut<{ document: ConfigDocument }>(
    `/api/agent-config/${type}/${encodeURIComponent(name)}`,
    input,
  );
  return data.document;
}

export async function deleteConfigDocument(type: ConfigType, name: string): Promise<void> {
  await apiDelete<{ type: ConfigType; name: string }>(
    `/api/agent-config/${type}/${encodeURIComponent(name)}`,
  );
}
