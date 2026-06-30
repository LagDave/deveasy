import type { SessionEvent } from "../../hooks/useSession";

/**
 * Turns the raw stream-json event list into clean, renderable items. The CLI emits
 * a lot of internal noise (init, hook_started/hook_progress system events); those
 * are collected separately so the transcript shows a real conversation, not a JSON
 * dump. Unknown shapes are preserved as `raw` so CLI schema drift never loses data.
 */

export type RenderItem =
  | { kind: "text"; role: "assistant" | "user"; text: string; key: string }
  | { kind: "tool_use"; name: string; input: unknown; key: string }
  | { kind: "tool_result"; content: string; isError: boolean; key: string }
  | { kind: "result"; text: string; isError: boolean; key: string }
  | { kind: "system"; subtype: string; raw: SessionEvent; key: string };

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
  is_error?: boolean;
}

function blocksOf(event: SessionEvent): ContentBlock[] {
  const message = event.message as { content?: unknown } | undefined;
  const content = message?.content;
  if (Array.isArray(content)) return content as ContentBlock[];
  if (typeof content === "string") return [{ type: "text", text: content }];
  return [];
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function flattenEvents(events: SessionEvent[]): RenderItem[] {
  const items: RenderItem[] = [];

  events.forEach((event, i) => {
    const type = event.type;

    if (type === "assistant" || type === "user") {
      const role = type === "assistant" ? "assistant" : "user";
      blocksOf(event).forEach((block, j) => {
        const key = `${i}-${j}`;
        if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
          items.push({ kind: "text", role, text: block.text, key });
        } else if (block.type === "tool_use") {
          items.push({ kind: "tool_use", name: block.name ?? "tool", input: block.input, key });
        } else if (block.type === "tool_result") {
          items.push({
            kind: "tool_result",
            content: stringify(block.content),
            isError: Boolean(block.is_error),
            key,
          });
        }
      });
      return;
    }

    if (type === "result") {
      const text = typeof event.result === "string" ? event.result : "";
      items.push({ kind: "result", text, isError: Boolean(event.is_error), key: `${i}-r` });
      return;
    }

    // init / hook_* / anything else -> system (collapsed by default in the UI).
    const subtype = typeof event.subtype === "string" ? event.subtype : type;
    items.push({ kind: "system", subtype, raw: event, key: `${i}-s` });
  });

  return items;
}

/** Count of non-noise items, used to decide whether the transcript looks empty. */
export function meaningfulCount(items: RenderItem[]): number {
  return items.filter((it) => it.kind !== "system").length;
}

/**
 * The Skill tool returns the entire SKILL.md prefixed with this line. Rendering
 * it raw floods the transcript, so callers collapse it to a one-line chip.
 */
const SKILL_LOAD_PREFIX = "Base directory for this skill:";

/**
 * If `text` is a skill-load dump, return the skill's folder name (for a compact
 * "Using skill: <name>" chip); otherwise null. Used by both the normal session
 * transcript and the create-project wizard.
 */
export function skillLoadName(text: string): string | null {
  if (!text.trimStart().startsWith(SKILL_LOAD_PREFIX)) return null;
  const match = text.match(/\/skills\/([^/\s]+)/);
  return match ? match[1] : "skill";
}
