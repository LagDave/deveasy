import type { IconName } from "../ui/Icon";

/**
 * Recognizes the leading workflow command on a chat message (the same vocabulary
 * as the CLAUDE.md command gate) so the UI can render it as a colored badge
 * instead of raw text. The flag stays in the sent/stored message — Claude's own
 * command gate still interprets it; we only change how the bubble renders.
 */
export interface CommandMeta {
  id: string;
  label: string;
  /** Canonical short flag, inserted when picked from the preset menu. */
  flag: string;
  icon: IconName;
  /** Static Tailwind classes (kept literal so they're not purged). */
  text: string;
  border: string;
  bg: string;
}

const PLAN: CommandMeta = { id: "plan", label: "Plan", flag: "-s", icon: "plan", text: "text-sky-300", border: "border-sky-400/40", bg: "bg-sky-400/10" };
const INSTANT: CommandMeta = { id: "instant", label: "Instant", flag: "-i", icon: "instant", text: "text-amber-300", border: "border-amber-400/40", bg: "bg-amber-400/10" };
const EXECUTE: CommandMeta = { id: "execute", label: "Execute", flag: "-x", icon: "execute", text: "text-emerald-300", border: "border-emerald-400/40", bg: "bg-emerald-400/10" };
const ASK: CommandMeta = { id: "ask", label: "Ask", flag: "-a", icon: "ask", text: "text-cyan-300", border: "border-cyan-400/40", bg: "bg-cyan-400/10" };
const CONTINUE: CommandMeta = { id: "continue", label: "Continue", flag: "-c", icon: "continue", text: "text-violet-300", border: "border-violet-400/40", bg: "bg-violet-400/10" };
const DONE: CommandMeta = { id: "done", label: "Done", flag: "-d", icon: "done", text: "text-green-300", border: "border-green-400/40", bg: "bg-green-400/10" };
const EXPLORE: CommandMeta = { id: "explore", label: "Explore", flag: "-b", icon: "explore", text: "text-teal-300", border: "border-teal-400/40", bg: "bg-teal-400/10" };
const QUICKFIX: CommandMeta = { id: "quickfix", label: "Quickfix", flag: "-q", icon: "quickfix", text: "text-orange-300", border: "border-orange-400/40", bg: "bg-orange-400/10" };
const STATUS: CommandMeta = { id: "status", label: "Status", flag: "-st", icon: "status", text: "text-slate-300", border: "border-slate-400/40", bg: "bg-slate-400/10" };
const REVIEW: CommandMeta = { id: "review", label: "Review", flag: "-r", icon: "review", text: "text-yellow-300", border: "border-yellow-400/40", bg: "bg-yellow-400/10" };
const UNDO: CommandMeta = { id: "undo", label: "Undo", flag: "-u", icon: "undo", text: "text-rose-300", border: "border-rose-400/40", bg: "bg-rose-400/10" };

/** Ordered presets for the composer's command picker. */
export const COMMAND_PRESETS: CommandMeta[] = [
  ASK, PLAN, INSTANT, EXECUTE, CONTINUE, QUICKFIX, EXPLORE, REVIEW, STATUS, DONE, UNDO,
];

/** Token (short + long form) -> command. Order-independent; matched on the first word. */
const TOKENS: Record<string, CommandMeta> = {
  "-s": PLAN, "--start": PLAN,
  "-i": INSTANT, "--instant": INSTANT,
  "-x": EXECUTE, "--execute": EXECUTE,
  "-a": ASK, "--ask": ASK,
  "-c": CONTINUE, "--continue": CONTINUE,
  "-d": DONE, "--done": DONE,
  "-b": EXPLORE, "--context-building": EXPLORE,
  "-q": QUICKFIX, "--quickfix": QUICKFIX,
  "-st": STATUS, "--status": STATUS,
  "-r": REVIEW, "--review": REVIEW,
  "-u": UNDO, "--undo": UNDO,
};

export interface ParsedCommand {
  command: CommandMeta | null;
  body: string;
}

/** Split a leading command flag off a message, if present. */
export function parseCommand(text: string): ParsedCommand {
  const match = text.match(/^\s*(--?[a-z-]+)\b\s*/i);
  if (match) {
    const command = TOKENS[match[1].toLowerCase()];
    if (command) return { command, body: text.slice(match[0].length) };
  }
  return { command: null, body: text };
}
