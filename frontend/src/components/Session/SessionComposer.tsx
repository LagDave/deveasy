import { useRef, useState } from "react";
import { useModels } from "../../hooks/queries/useModelsQueries";
import { activeModel, EFFORT_LEVELS } from "../../utils/modelLabels";
import { Icon } from "../ui/Icon";
import { COMMAND_PRESETS, parseCommand } from "./chatCommands";
import { ContextRing } from "./ContextRing";
import { EffortPicker } from "./EffortPicker";
import { ModelPicker } from "./ModelPicker";

/**
 * Message input. A message is sendable when it begins with a recognized workflow
 * command (type one or pick a preset) OR with a `/` slash command (skills, /compact,
 * etc.) — the latter bypasses the workflow-command gate and is sent verbatim to the
 * CLI. Before Send sit the model picker, thinking-effort picker, and context ring.
 * Enter sends, Shift+Enter inserts a newline.
 */
interface SessionComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
  hint?: string;
  /** Selected model id (or null=CLI default) — drives the picker check. */
  selectedModel: string | null;
  /** Resolved versioned model from the CLI init event (e.g. claude-opus-4-8). */
  resolvedModel: string | null;
  /** Selected thinking effort (low/medium/high/xhigh/max) or null. */
  selectedEffort: string | null;
  /** Available slash commands / skills for autocomplete. */
  slashCommands: string[];
  /** Context-window usage, or null until known. */
  context: { used: number; window: number } | null;
  /** Switch the session model; only honored when idle. */
  onSetModel: (model: string | null) => void;
  /** Change the session thinking effort; only honored when idle. */
  onSetEffort: (effort: string | null) => void;
}

const MAX_ROWS_PX = 200;

/** Built-in CLI actions always offered in the slash autocomplete (even pre-init). */
const BUILTIN_SLASH = ["compact", "context", "clear"];

export function SessionComposer({
  onSend,
  disabled,
  hint,
  selectedModel,
  resolvedModel,
  selectedEffort,
  slashCommands,
  context,
  onSetModel,
  onSetEffort,
}: SessionComposerProps) {
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const catalog = useModels().data;
  const models = catalog?.models ?? [];
  const active = activeModel(models, selectedModel, resolvedModel);
  // Effort levels for the active model; unknown model -> offer all; unsupported -> none.
  const effortLevels = active ? (active.effortSupported ? active.efforts : []) : [...EFFORT_LEVELS];

  const trimmed = text.trim();
  const command = parseCommand(trimmed).command;
  const isSlash = trimmed.startsWith("/");
  const missingCommand = trimmed.length > 0 && !command && !isSlash;
  const canSend = !disabled && trimmed.length > 0 && (Boolean(command) || isSlash);

  // Skill autocomplete: when the message is just a partial `/word` (no space yet),
  // suggest matching slash commands. Built-in actions (compact/context/clear) are
  // always offered alongside the session's own skills/slash commands.
  const slashMatch = text.match(/^\s*\/(\S*)$/);
  const commandPool = Array.from(new Set([...BUILTIN_SLASH, ...slashCommands]));
  const suggestions =
    slashMatch && !slashDismissed
      ? commandPool.filter((c) => c.toLowerCase().startsWith(slashMatch[1].toLowerCase())).slice(0, 8)
      : [];

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  };

  const setText2 = (next: string) => {
    setText(next);
    setActiveSuggestion(0);
    setSlashDismissed(false);
    requestAnimationFrame(grow);
  };

  /** Set or replace the leading command flag, keeping the message body. */
  const applyPreset = (flag: string) => {
    const { body } = parseCommand(text);
    setText2(`${flag} ${body}`.trimEnd() + (body ? "" : " "));
    setMenuOpen(false);
    ref.current?.focus();
  };

  /** Insert a chosen slash command, leaving a trailing space to type arguments. */
  const applySlash = (name: string) => {
    setText2(`/${name} `);
    ref.current?.focus();
  };

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setText("");
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = "auto";
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash-command autocomplete navigation takes priority while it's open.
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applySlash(suggestions[Math.min(activeSuggestion, suggestions.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashDismissed(true);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const borderClass = command
    ? command.border
    : isSlash
      ? "border-accent-line"
      : missingCommand
        ? "border-danger/50"
        : "focus-within:border-accent-line";

  return (
    <div className="border-t border-line px-6 py-4">
      <div className="mx-auto max-w-3xl">
        <div className={`surface flex items-center gap-2 p-2 ${borderClass}`}>
          {/* Command picker / active-command indicator */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={disabled}
              className={`btn !px-2.5 !py-1.5 ${command ? `${command.text} ${command.border} ${command.bg}` : "btn-ghost"}`}
              title="Pick a command"
            >
              <Icon name={command?.icon ?? "add"} size={15} />
              <span className="font-mono text-xs">{command ? command.label : "Command"}</span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="surface absolute bottom-full left-0 z-20 mb-2 max-h-72 w-52 overflow-y-auto p-1">
                  {COMMAND_PRESETS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => applyPreset(c.flag)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-surface-2"
                    >
                      <span className={c.text}>
                        <Icon name={c.icon} size={15} />
                      </span>
                      <span className="flex-1 text-sm">{c.label}</span>
                      <span className="font-mono text-xs text-faint">{c.flag}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {/* Skill / slash-command autocomplete */}
            {suggestions.length > 0 && (
              <div className="surface absolute bottom-full left-0 z-30 mb-2 max-h-60 w-60 overflow-y-auto p-1">
                {suggestions.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    onMouseEnter={() => setActiveSuggestion(i)}
                    onClick={() => applySlash(name)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-surface-2 ${
                      i === activeSuggestion ? "bg-surface-2" : ""
                    }`}
                  >
                    <span className="font-mono text-xs text-accent">/{name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText2(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={disabled ? "Waiting for the session…" : "Message Claude…  (/ for skills)"}
            rows={1}
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-ink outline-none placeholder:text-faint disabled:opacity-60"
          />

          {/* Model · effort · context — the status controls before Send */}
          <ModelPicker
            catalog={catalog}
            selectedModel={selectedModel}
            resolvedModel={resolvedModel}
            disabled={disabled}
            onSelect={onSetModel}
          />
          <EffortPicker
            levels={effortLevels}
            selectedEffort={selectedEffort}
            disabled={disabled}
            onSelect={onSetEffort}
          />
          {context && context.window > 0 && <ContextRing used={context.used} window={context.window} />}

          <button onClick={submit} disabled={!canSend} className="btn btn-primary">
            Send
          </button>
        </div>
        <p className={`eyebrow mt-2 px-1 ${missingCommand ? "!text-danger" : ""}`}>
          {disabled
            ? (hint ?? "Waiting for the session…")
            : missingCommand
              ? "Start with a valid command, or / for a skill"
              : (hint ?? "Enter to send · Shift+Enter for a new line")}
        </p>
      </div>
    </div>
  );
}
