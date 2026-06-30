import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { childLogger } from "../lib/logger";

const log = childLogger({ module: "ClaudeUsageService" });

/**
 * Reads the operator's Claude subscription usage (5-hour and weekly windows) from
 * the same OAuth token Claude Code stores, via the undocumented
 * `GET /api/oauth/usage` endpoint.
 *
 * This is deliberately quarantined (§ risk R-A/R-B): the endpoint is unofficial and
 * rate-limits hard, so results are cached and a 429 triggers a long backoff; the
 * OAuth token never leaves this module — it is never logged, never persisted, and
 * never returned to a caller. Any failure degrades to `{ available: false }` so the
 * rest of the app is indifferent to the endpoint's health.
 */

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const OAUTH_BETA = "oauth-2025-04-20";
const KEYCHAIN_SERVICE = "Claude Code-credentials";
const REQUEST_TIMEOUT_MS = 8_000;
/** Serve a cached value for this long before refetching. */
const CACHE_TTL_MS = 90_000;
/** After a 429, do not refetch for this long (the endpoint rate-limits aggressively). */
const BACKOFF_MS = 5 * 60_000;

/** One subscription limit window. `utilization` is a 0–100 percent. */
export interface UsageWindow {
  utilization: number;
  resetsAt: string | null;
}

/** Public usage snapshot — never contains the token. */
export interface UsageLimits {
  available: boolean;
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
  fetchedAt: string;
}

interface CacheEntry {
  value: UsageLimits;
  expiresAt: number;
}

export class ClaudeUsageService {
  private static cache: CacheEntry | null = null;
  /** Epoch ms before which we must not hit the endpoint again (429 backoff). */
  private static backoffUntil = 0;

  /** Get usage limits, served from cache when fresh. Never throws. */
  static async getLimits(): Promise<UsageLimits> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) return this.cache.value;
    if (now < this.backoffUntil) {
      // Still backing off from a 429 — serve stale if we have it, else unavailable.
      return this.cache?.value ?? this.unavailable();
    }

    try {
      const value = await this.fetchLimits();
      this.cache = { value, expiresAt: now + CACHE_TTL_MS };
      return value;
    } catch (err) {
      log.warn({ err: errMessage(err) }, "Usage fetch failed; serving unavailable");
      return this.cache?.value ?? this.unavailable();
    }
  }

  private static unavailable(): UsageLimits {
    return { available: false, fiveHour: null, sevenDay: null, fetchedAt: new Date().toISOString() };
  }

  private static async fetchLimits(): Promise<UsageLimits> {
    const token = this.readToken();
    if (!token) {
      log.warn("No OAuth token found (keychain/credentials file); usage unavailable");
      return this.unavailable();
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(USAGE_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          "anthropic-beta": OAUTH_BETA,
          "User-Agent": "deveasy/0.1 (usage-meter)",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 429) {
      this.backoffUntil = Date.now() + BACKOFF_MS;
      log.warn("Usage endpoint rate-limited (429); backing off");
      return this.cache?.value ?? this.unavailable();
    }
    if (!res.ok) {
      log.warn({ status: res.status }, "Usage endpoint returned non-OK");
      return this.unavailable();
    }

    const body = (await res.json()) as unknown;
    return this.parse(body);
  }

  /** Parse the endpoint payload defensively (§ risk R-F: field names may drift). */
  private static parse(body: unknown): UsageLimits {
    const obj = (body ?? {}) as Record<string, unknown>;
    const fiveHour = this.window(obj.five_hour);
    const sevenDay = this.window(obj.seven_day);
    return {
      available: Boolean(fiveHour || sevenDay),
      fiveHour,
      sevenDay,
      fetchedAt: new Date().toISOString(),
    };
  }

  private static window(raw: unknown): UsageWindow | null {
    if (!raw || typeof raw !== "object") return null;
    const w = raw as Record<string, unknown>;
    const utilization = typeof w.utilization === "number" ? w.utilization : null;
    if (utilization === null) return null;
    return { utilization, resetsAt: typeof w.resets_at === "string" ? w.resets_at : null };
  }

  /**
   * Read the OAuth access token. macOS keeps it in the keychain; other platforms
   * use the plaintext credentials file. The token stays in this module.
   */
  private static readToken(): string | null {
    const fromKeychain = process.platform === "darwin" ? this.readKeychain() : null;
    const rawJson = fromKeychain ?? this.readCredentialsFile();
    if (!rawJson) return null;
    try {
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
      const oauth = (parsed.claudeAiOauth ?? parsed) as Record<string, unknown>;
      const token = oauth.accessToken;
      return typeof token === "string" && token ? token : null;
    } catch {
      return null;
    }
  }

  private static readKeychain(): string | null {
    try {
      const out = spawnSync("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"], {
        encoding: "utf8",
        timeout: REQUEST_TIMEOUT_MS,
      });
      if (out.status === 0 && out.stdout) return out.stdout.trim();
    } catch {
      // fall through to the file
    }
    return null;
  }

  private static readCredentialsFile(): string | null {
    try {
      return readFileSync(join(homedir(), ".claude", ".credentials.json"), "utf8");
    } catch {
      return null;
    }
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
