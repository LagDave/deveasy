import { useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { COMMAND_PRESETS, parseCommand } from "./chatCommands";
import { ContextRing } from "./ContextRing";

/**
 * Message input. A message is sendable when it begins with a recognized workflow
 * command (type one or pick a preset) OR with a `/` slash command (skills, /compact,
 * etc.) — the latter bypasses the workflow-command gate and is sent verbatim to the
 * CLI. The input takes the active command's color + icon. Enter sends, Shift+Enter
 * inserts a newline. A model picker switches the session's model (when idle) and a
 * context ring shows how full the context window is.
 */
interface SessionComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
  hint?: string;
  /** Resolved model in use (from the CLI init event). */
  model: string | null;
  /** Available slash commands / skills for autocomplete. */
  slashCommands: string[];
  /** Context-window usage, or null until known. */
  context: { used: number; window: number } | null;
  /** Switch the session model; only honored when idle. */
  onSetModel: (model: string | null) => void;
}

const MAX_ROWS_PX = 200;

/** Curated model aliases — stable handles that always resolve to the latest tier. */
const MODEL_ALIASES: { id: string | null; label: string }[] = [
  { id: null, label: "Default" },
  { id: "opus", label: "Opus" },
  { id: "sonnet", label: "Sonnet" },
  { id: "haiku", label: "Haiku" },
  { id: "fable", label: "Fable" },
];

/** Short label for the resolved model string (e.g. "claude-opus-4-8[1m]" -> "Opus"). */
function modelShortLabel(model: string | null): string {
  if (!model) return "Model";
  const m = model.toLowerCase();
  const hit = MODEL_ALIASES.find((a) => a.id && m.includes(a.id));
  return hit ? hit.label : "Model";
}

export function SessionComposer({
  onSend,
  disabled,
  hint,
  model,
  slashCommands,
  context,
  onSetModel,
}: SessionComposerProps) {
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const trimmed = text.trim();
  const active = parseCommand(trimmed).command;
  const isSlash = trimmed.startsWith("/");
  const missingCommand = trimmed.length > 0 && !active && !isSlash;
  const canSend = !disabled && trimmed.length > 0 && (Boolean(active) || isSlash);

  // Skill autocomplete: when the message is just a partial `/word` (no space yet),
  // suggest matching slash commands.
  const slashMatch = text.match(/^\s*\/(\S*)$/);
  const suggestions =
    slashMatch && slashCommands.length
      ? slashCommands.filter((c) => c.toLowerCase().startsWith(slashMatch[1].toLowerCase())).slice(0, 8)
      : [];

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  };

  const setText2 = (next: string) => {
    setText(next);
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const chooseModel = (id: string | null) => {
    onSetModel(id);
    setModelOpen(false);
  };

  const borderClass = active
    ? active.border
    : isSlash
      ? "border-accent-line"
      : missingCommand
        ? "border-danger/50"
        : "focus-within:border-accent-line";

  return (
    <div className="border-t border-line px-6 py-4">
      <div className="mx-auto max-w-3xl">
        {/* Controls row: model picker + compact */}
        <div className="mb-2 flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setModelOpen((o) => !o)}
              disabled={disabled}
              className="btn btn-ghost !px-2.5 !py-1 disabled:opacity-50"
              title={disabled ? "Switch model when idle" : "Switch model (keeps context)"}
            >
              <Icon name="instant" size={13} />
              <span className="font-mono text-xs">{modelShortLabel(model)}</span>
            </button>
            {modelOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setModelOpen(false)} />
                <div className="surface absolute bottom-full left-0 z-20 mb-2 w-44 p-1">
                  {MODEL_ALIASES.map((a) => {
                    const isCurrent = a.label === modelShortLabel(model) || (a.id === null && !model);
                    return (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => chooseModel(a.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-2"
                      >
                        <span>{a.label}</span>
                        {isCurrent && <Icon name="done" size={13} className="text-success" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSend("/compact")}
            disabled={disabled}
            className="btn btn-ghost !px-2.5 !py-1 disabled:opacity-50"
            title="Compact this conversation to free context"
          >
            <Icon name="quickfix" size={13} />
            <span className="font-mono text-xs">/compact</span>
          </button>
        </div>

        <div className={`surface flex items-end gap-2 p-2 ${borderClass}`}>
          {/* Command picker / active-command indicator */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={disabled}
              className={`btn !px-2.5 !py-1.5 ${active ? `${active.text} ${active.border} ${active.bg}` : "btn-ghost"}`}
              title="Pick a command"
            >
              <Icon name={active?.icon ?? "add"} size={15} />
              <span className="font-mono text-xs">{active ? active.label : "Command"}</span>
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
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => applySlash(name)}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-surface-2"
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
          <button onClick={submit} disabled={!canSend} className="btn btn-primary">
            Send
          </button>
          {context && context.window > 0 && <ContextRing used={context.used} window={context.window} />}
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
