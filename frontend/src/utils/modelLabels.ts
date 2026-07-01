import type { ClaudeModel } from "../types/models";

/**
 * Model + effort label helpers, shared by the composer pickers and the session hook.
 * Pure, framework-free (Constitution §12.2 utils).
 *
 * Selection vs resolved:
 *  - selection: the model id / effort the operator picked, known the instant they click.
 *  - resolved: the versioned model string the CLI reports in its init event
 *    (e.g. `claude-opus-4-8[1m]`), known only after the model next runs.
 */

/** Effort (thinking) levels the CLI accepts, ascending. */
export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;

/** Family of a model id/string: "opus" | "sonnet" | "haiku" | "fable" | null. */
export function familyOf(model: string | null): string | null {
  if (!model) return null;
  const m = model.toLowerCase().match(/(opus|sonnet|haiku|fable)/);
  return m ? m[1] : null;
}

/**
 * Friendly versioned name from a resolved model string, keeping the version:
 * `claude-opus-4-8[1m]` -> "Opus 4.8", `claude-sonnet-5` -> "Sonnet 5".
 */
export function prettyModel(model: string | null): string | null {
  if (!model) return null;
  let s = model.replace(/\[[^\]]*\]\s*$/, "").trim();
  s = s.replace(/^claude-/, "");
  const m = s.match(/^(opus|sonnet|haiku|fable)/);
  if (!m) return model;
  const family = m[1][0].toUpperCase() + m[1].slice(1);
  let rest = s.slice(m[1].length).replace(/^-/, "");
  rest = rest.replace(/-?\d{8}$/, "");
  const version = rest.replace(/-/g, ".").replace(/\.+$/, "");
  return version ? `${family} ${version}` : family;
}

/** "Claude Opus 4.8" -> "Opus 4.8" (drop the vendor prefix for compact display). */
export function shortName(displayName: string): string {
  return displayName.replace(/^Claude\s+/i, "");
}

/** Capitalized effort label ("high" -> "High"). */
export function effortLabel(level: string | null): string {
  if (!level) return "Effort";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

const FAMILY_ORDER = ["opus", "sonnet", "haiku", "fable"];

/**
 * Split the catalog into the latest model per family (the picker's top tier) and
 * everything older ("More models"). Top tier is ordered opus → sonnet → haiku → fable.
 */
export function latestPerFamily(models: ClaudeModel[]): { top: ClaudeModel[]; more: ClaudeModel[] } {
  const byFamily = new Map<string, ClaudeModel>();
  for (const m of models) {
    const fam = familyOf(m.id);
    if (!fam) continue;
    const cur = byFamily.get(fam);
    if (!cur || (m.createdAt ?? "") > (cur.createdAt ?? "")) byFamily.set(fam, m);
  }
  const top = FAMILY_ORDER.map((f) => byFamily.get(f)).filter((m): m is ClaudeModel => Boolean(m));
  const topIds = new Set(top.map((m) => m.id));
  const more = models.filter((m) => !topIds.has(m.id));
  return { top, more };
}

/** The model record matching the current selection (by id) or resolved family. */
export function activeModel(
  models: ClaudeModel[],
  selectedModel: string | null,
  resolvedModel: string | null,
): ClaudeModel | undefined {
  if (selectedModel) {
    const byId = models.find((m) => m.id === selectedModel);
    if (byId) return byId;
  }
  const fam = familyOf(resolvedModel);
  return fam ? models.find((m) => familyOf(m.id) === fam) : undefined;
}

// --- last-used preferences (defaults for new sessions) ---

const LAST_MODEL_KEY = "deveasy:last-model";
const LAST_EFFORT_KEY = "deveasy:last-effort";

function getPref(key: string): string | null {
  try {
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}
function setPref(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable — preference just won't persist
  }
}

export const getLastModel = () => getPref(LAST_MODEL_KEY);
export const setLastModel = (id: string | null) => setPref(LAST_MODEL_KEY, id);
export const getLastEffort = () => getPref(LAST_EFFORT_KEY);
export const setLastEffort = (level: string | null) => setPref(LAST_EFFORT_KEY, level);
