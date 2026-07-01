import { childLogger } from "../lib/logger";
import { oauthHeaders, readClaudeOAuthToken } from "./claudeOAuth";

const log = childLogger({ module: "ClaudeModelsService" });

/**
 * Lists the models available to the operator's subscription via the Anthropic
 * `GET /v1/models` endpoint, authenticated with the same OAuth token as usage
 * (§5.1/§5.3 — token stays server-side). Cached: the catalog changes rarely, so a
 * long TTL avoids hammering the API; any failure degrades to an empty list so the
 * picker can fall back gracefully.
 */

const MODELS_URL = "https://api.anthropic.com/v1/models?limit=100";
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 10 * 60_000;

/** Effort levels the CLI accepts, in ascending order. */
export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;

export interface ClaudeModel {
  id: string;
  displayName: string;
  contextWindow: number | null;
  createdAt: string | null;
  /** Effort is selectable for this model. */
  effortSupported: boolean;
  /** The effort levels this model supports (subset of EFFORT_LEVELS). */
  efforts: string[];
}

export interface ModelCatalog {
  available: boolean;
  models: ClaudeModel[];
}

interface CacheEntry {
  value: ModelCatalog;
  expiresAt: number;
}

export class ClaudeModelsService {
  private static cache: CacheEntry | null = null;

  /** Get the model catalog, served from cache when fresh. Never throws. */
  static async getModels(): Promise<ModelCatalog> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) return this.cache.value;
    try {
      const value = await this.fetchModels();
      // Only cache a non-empty catalog so a transient failure isn't sticky.
      if (value.available) this.cache = { value, expiresAt: now + CACHE_TTL_MS };
      return value;
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : String(err) }, "Model list fetch failed");
      return this.cache?.value ?? { available: false, models: [] };
    }
  }

  private static async fetchModels(): Promise<ModelCatalog> {
    const token = readClaudeOAuthToken();
    if (!token) {
      log.warn("No OAuth token found; model list unavailable");
      return { available: false, models: [] };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(MODELS_URL, {
        headers: { ...oauthHeaders(token), "anthropic-version": "2023-06-01" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      log.warn({ status: res.status }, "Model list endpoint returned non-OK");
      return { available: false, models: [] };
    }

    const body = (await res.json()) as { data?: unknown };
    const rows = Array.isArray(body.data) ? body.data : [];
    const models = rows.map((r) => this.parseModel(r)).filter((m): m is ClaudeModel => m !== null);
    return { available: models.length > 0, models };
  }

  private static parseModel(raw: unknown): ClaudeModel | null {
    if (!raw || typeof raw !== "object") return null;
    const m = raw as Record<string, unknown>;
    if (typeof m.id !== "string") return null;
    const caps = (m.capabilities ?? {}) as Record<string, unknown>;
    const effortCap = (caps.effort ?? {}) as Record<string, unknown>;
    const efforts = EFFORT_LEVELS.filter((lvl) => {
      const entry = effortCap[lvl] as { supported?: unknown } | undefined;
      return Boolean(entry?.supported);
    });
    return {
      id: m.id,
      displayName: typeof m.display_name === "string" ? m.display_name : m.id,
      contextWindow: typeof m.max_input_tokens === "number" ? m.max_input_tokens : null,
      createdAt: typeof m.created_at === "string" ? m.created_at : null,
      effortSupported: Boolean((effortCap as { supported?: unknown }).supported) && efforts.length > 0,
      efforts,
    };
  }
}
