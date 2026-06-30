/**
 * Pure, framework-free parsing for the wizard JSON protocol (§12.2 utils). The
 * agent emits one fenced code block per turn — `deveasy-question` to ask, or
 * `deveasy-done` when finished. Parsing is deliberately tolerant: any malformed
 * or missing block returns null and the caller falls back to plain markdown +
 * the free-text reply box.
 */

export type WizardQuestionType = "single" | "multi" | "text";

export interface WizardOption {
  value: string;
  label: string;
  hint?: string;
}

export interface WizardQuestion {
  id: string;
  prompt: string;
  type: WizardQuestionType;
  options: WizardOption[];
  allowOther?: boolean;
}

export interface WizardDone {
  project: string;
  summary: string;
}

/** Match every fenced block of a given language tag; the LAST one wins. */
function lastFencedBlock(text: string, lang: string): string | null {
  const fence = new RegExp("```" + lang + "\\s*\\n([\\s\\S]*?)```", "g");
  let match: RegExpExecArray | null;
  let last: string | null = null;
  while ((match = fence.exec(text)) !== null) {
    last = match[1];
  }
  return last;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw.trim());
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseOptions(raw: unknown): WizardOption[] | null {
  if (!Array.isArray(raw)) return null;
  const options: WizardOption[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    if (typeof item.value !== "string" || typeof item.label !== "string") return null;
    const option: WizardOption = { value: item.value, label: item.label };
    if (typeof item.hint === "string") option.hint = item.hint;
    options.push(option);
  }
  return options;
}

const QUESTION_TYPES: readonly WizardQuestionType[] = ["single", "multi", "text"];

/** Extract the last `deveasy-question` block as a validated question, else null. */
export function parseWizardQuestion(text: string): WizardQuestion | null {
  const block = lastFencedBlock(text, "deveasy-question");
  if (block === null) return null;
  const parsed = safeParse(block);
  if (!isRecord(parsed)) return null;
  if (typeof parsed.id !== "string" || typeof parsed.prompt !== "string") return null;
  if (!QUESTION_TYPES.includes(parsed.type as WizardQuestionType)) return null;

  const type = parsed.type as WizardQuestionType;
  // Text questions need no options; choice questions require a valid list.
  const options = type === "text" ? (parseOptions(parsed.options) ?? []) : parseOptions(parsed.options);
  if (options === null) return null;

  const question: WizardQuestion = { id: parsed.id, prompt: parsed.prompt, type, options };
  if (typeof parsed.allowOther === "boolean") question.allowOther = parsed.allowOther;
  return question;
}

/** Extract the last `deveasy-done` block as a validated completion, else null. */
export function parseWizardDone(text: string): WizardDone | null {
  const block = lastFencedBlock(text, "deveasy-done");
  if (block === null) return null;
  const parsed = safeParse(block);
  if (!isRecord(parsed)) return null;
  if (typeof parsed.project !== "string") return null;
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  return { project: parsed.project, summary };
}

/**
 * Build the human-readable answer text sent back into the session. The agent
 * reads the label(s) naturally and the `[id=value]` tail removes ambiguity, e.g.
 * `Yes — scaffold MSAL auth [auth=msal]`.
 */
export function formatChoiceAnswer(q: WizardQuestion, selectedValues: string[]): string {
  if (q.type === "text") {
    const typed = selectedValues[0] ?? "";
    return `${typed} [${q.id}=${typed}]`;
  }
  const labels = selectedValues.map((v) => q.options.find((o) => o.value === v)?.label ?? v);
  const labelText = labels.join(", ");
  const valueText = selectedValues.join(",");
  return `${labelText} [${q.id}=${valueText}]`;
}

/** Strip every `deveasy-question`/`deveasy-done` fenced block from visible text. */
export function stripWizardBlocks(text: string): string {
  return text
    .replace(/```deveasy-question\s*\n[\s\S]*?```/g, "")
    .replace(/```deveasy-done\s*\n[\s\S]*?```/g, "")
    .trim();
}

// The opening turn for a create-project session. The leading `-i` passes the
// injected CLAUDE.md command gate; the rest invokes the skill, which then drives
// the deveasy-question protocol. SEED_PREFIX lets the transcript recognize and
// hide this technical turn.
export const SEED_PREFIX = "-i Scaffold a new TypeScript project named";

export function buildSeedTurn(projectName: string): string {
  return `${SEED_PREFIX} "${projectName}". Invoke the create-new-ts-project skill and follow its wizard protocol exactly — ask me each question as a deveasy-question JSON block and wait for my answer.`;
}

/** True if a user turn is the technical create-session seed (hidden from the UI). */
export function isSeedTurnText(text: string): boolean {
  return text.startsWith(SEED_PREFIX);
}
