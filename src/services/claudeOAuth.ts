import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Reads the operator's Claude subscription OAuth access token — the same token
 * Claude Code stores. macOS keeps it in the keychain; other platforms use the
 * plaintext credentials file. The token must never be logged or returned to a
 * client (§5.1, §5.3): callers keep it server-side and only expose derived data.
 */

const KEYCHAIN_SERVICE = "Claude Code-credentials";
const READ_TIMEOUT_MS = 8_000;

export function readClaudeOAuthToken(): string | null {
  const fromKeychain = process.platform === "darwin" ? readKeychain() : null;
  const rawJson = fromKeychain ?? readCredentialsFile();
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

function readKeychain(): string | null {
  try {
    const out = spawnSync("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"], {
      encoding: "utf8",
      timeout: READ_TIMEOUT_MS,
    });
    if (out.status === 0 && out.stdout) return out.stdout.trim();
  } catch {
    // fall through to the file
  }
  return null;
}

function readCredentialsFile(): string | null {
  try {
    return readFileSync(join(homedir(), ".claude", ".credentials.json"), "utf8");
  } catch {
    return null;
  }
}

/** Shared headers for authenticated OAuth calls to the Anthropic API. */
export function oauthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "anthropic-beta": "oauth-2025-04-20",
    "User-Agent": "deveasy/0.1",
  };
}
