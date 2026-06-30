/**
 * Model label helpers, shared by the composer (pill + picker) and the session hook
 * (switch notice). Pure, framework-free (Constitution §12.2 utils).
 *
 * Two distinct things are kept separate on purpose:
 *  - selection: the alias the operator picked (`opus`/`sonnet`/… or null=Default),
 *    known the instant they click.
 *  - resolved: the versioned model string the CLI reports in its init event
 *    (e.g. `claude-opus-4-8[1m]`), known only after the model next runs.
 */

/** Curated, stable model aliases for the picker. null = the CLI default. */
export const MODEL_ALIASES: { id: string | null; label: string }[] = [
  { id: null, label: "Default" },
  { id: "opus", label: "Opus" },
  { id: "sonnet", label: "Sonnet" },
  { id: "haiku", label: "Haiku" },
  { id: "fable", label: "Fable" },
];

/** Family of a resolved model string: "opus" | "sonnet" | "haiku" | "fable" | null. */
export function familyOf(model: string | null): string | null {
  if (!model) return null;
  const m = model.toLowerCase().match(/(opus|sonnet|haiku|fable)/);
  return m ? m[1] : null;
}

/** Picker label for an alias id ("opus" -> "Opus", null -> "Default"). */
export function aliasLabel(id: string | null): string {
  const hit = MODEL_ALIASES.find((a) => a.id === id);
  return hit ? hit.label : "Model";
}

/**
 * Friendly versioned name from a resolved model string, keeping the version:
 * `claude-opus-4-8[1m]` -> "Opus 4.8", `claude-sonnet-5` -> "Sonnet 5",
 * `claude-haiku-4-5-20251001` -> "Haiku 4.5".
 */
export function prettyModel(model: string | null): string | null {
  if (!model) return null;
  let s = model.replace(/\[[^\]]*\]\s*$/, "").trim(); // strip the [1m] context marker
  s = s.replace(/^claude-/, "");
  const m = s.match(/^(opus|sonnet|haiku|fable)/);
  if (!m) return model;
  const family = m[1][0].toUpperCase() + m[1].slice(1);
  let rest = s.slice(m[1].length).replace(/^-/, "");
  rest = rest.replace(/-?\d{8}$/, ""); // drop a trailing -YYYYMMDD build date
  const version = rest.replace(/-/g, ".").replace(/\.+$/, "");
  return version ? `${family} ${version}` : family;
}

/**
 * The label for the composer's model pill. Prefer the resolved version when it
 * matches the current selection (or Default); otherwise fall back to the selected
 * alias so a just-clicked switch reflects immediately, before the model has run.
 */
export function modelPillLabel(selected: string | null, resolved: string | null): string {
  if (resolved) {
    const fam = familyOf(resolved);
    if (!selected || fam === selected) return prettyModel(resolved) ?? aliasLabel(selected);
  }
  return selected ? aliasLabel(selected) : "Model";
}
