import type { ModelCatalog } from "../types/models";
import { apiGet } from "./index";

/**
 * Model catalog domain (Constitution §12.1). The backend fetches the list from the
 * Anthropic models endpoint with the server-side OAuth token; the client only ever
 * sees model metadata, never the token.
 */
export async function getModels(): Promise<ModelCatalog> {
  const data = await apiGet<{ catalog: ModelCatalog }>("/api/usage/models");
  return data.catalog;
}
