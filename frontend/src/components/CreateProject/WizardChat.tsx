import { useEffect, useMemo, useRef } from "react";
import { useSession } from "../../hooks/useSession";
import { flattenEvents, type RenderItem } from "../Session/sessionEvents";
import { Icon } from "../ui/Icon";
import { Markdown } from "../ui/Markdown";
import { Spinner } from "../ui/Spinner";
import { WizardChoice } from "./WizardChoice";
import {
  parseWizardDone,
  parseWizardQuestion,
  stripWizardBlocks,
  type WizardDone,
} from "./wizardProtocol";

/**
 * The wizard conversation surface. Reuses the live session hook (useSession)
 * against the session the create endpoint opened — no duplicated WebSocket
 * logic. On first ready it seeds one gated turn that invokes the skill; from
 * then on it renders the streamed transcript and turns the latest assistant
 * question into clickable choices via the deveasy-question protocol.
 */
export function WizardChat({
  sessionId,
  projectName,
  onDone,
}: {
  sessionId: number;
  projectName: string;
  onDone?: (done: WizardDone) => void;
}) {
  const { events, send, isReady, streaming, partialText } = useSession(sessionId);
  const seededRef = useRef(false);
  const doneRef = useRef(false);

  // Seed exactly one turn once the session is ready. The leading `-i` passes the
  // injected CLAUDE.md command gate; the rest invokes the skill, which then
  // overrides the gate and drives the deveasy-question protocol.
  useEffect(() => {
    if (!isReady || seededRef.current) return;
    seededRef.current = true;
    send(seedTurn(projectName));
  }, [isReady, projectName, send]);

  const items = useMemo(() => flattenEvents(events), [events]);
  // Show the conversation, but never the technical gate-passing seed turn. The
  // skill-load dump is kept (rendered as a compact chip, not a wall of text).
  const textItems = useMemo(
    () => items.filter(isVisibleText).filter((it) => !isSeedTurn(it)),
    [items],
  );
  // Detect the question/done off the last *real* assistant turn — skip the skill
  // dump, whose embedded example blocks would otherwise trigger a bogus question.
  const lastAssistant = [...textItems]
    .reverse()
    .find((it) => it.role === "assistant" && !isSkillLoad(it));

  const question = lastAssistant ? parseWizardQuestion(lastAssistant.text) : null;
  const done = lastAssistant ? parseWizardDone(lastAssistant.text) : null;

  // Fire onDone once when the completion block arrives.
  useEffect(() => {
    if (done && !doneRef.current) {
      doneRef.current = true;
      onDone?.(done);
    }
  }, [done, onDone]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-1">
      {items.map((it) => {
        if (it.kind === "text") {
          if (isSeedTurn(it)) return null;
          if (isSkillLoad(it)) return <SkillChip key={it.key} />;
          return <ChatBubble key={it.key} role={it.role} text={visibleText(it.text)} />;
        }
        if (it.kind === "tool_use") {
          if (FILE_TOOLS.has(it.name)) {
            const path = toolFilePath(it.input);
            return path ? <FileLine key={it.key} path={relProjectPath(path)} /> : null;
          }
          if (it.name === "Bash") {
            const command = toolCommand(it.input);
            return command ? <CommandLine key={it.key} command={command} /> : null;
          }
        }
        // tool_result / result / system / read-only tools → hidden noise.
        return null;
      })}

      {partialText && <ChatBubble role="assistant" text={visibleText(partialText)} />}

      {streaming && !partialText && (
        <div className="surface-2 w-fit rounded-2xl rounded-bl-md px-4 py-3">
          <Spinner label="Claude is working" />
        </div>
      )}

      {done ? (
        <div className="surface mt-2 flex flex-col gap-1.5 px-4 py-3.5">
          <span className="eyebrow !text-success">Project ready</span>
          <p className="m-0 text-sm text-ink">{done.summary || `${done.project} is scaffolded.`}</p>
        </div>
      ) : question ? (
        <WizardChoice key={lastAssistant?.key} question={question} onSubmit={send} />
      ) : null}
    </div>
  );
}

// Kept in sync: the seed turn is built from SEED_PREFIX so the transcript filter
// can reliably recognize and hide it.
const SEED_PREFIX = `-i Scaffold a new TypeScript project named`;

// The Skill tool returns the whole SKILL.md prefixed with this line. Rendering it
// raw floods the chat, so we collapse it to a one-line chip.
const SKILL_LOAD_PREFIX = "Base directory for this skill:";

function seedTurn(projectName: string): string {
  return `${SEED_PREFIX} "${projectName}". Invoke the create-new-ts-project skill and follow its wizard protocol exactly — ask me each question as a deveasy-question JSON block and wait for my answer.`;
}

type TextItem = Extract<RenderItem, { kind: "text" }>;

function isVisibleText(item: RenderItem): item is TextItem {
  return item.kind === "text";
}

function isSeedTurn(item: TextItem): boolean {
  return item.role === "user" && item.text.startsWith(SEED_PREFIX);
}

function isSkillLoad(item: TextItem): boolean {
  return item.text.trimStart().startsWith(SKILL_LOAD_PREFIX);
}

// Tools whose invocation means "a file is being created/edited" — surfaced as a
// compact file line so the user can watch the scaffold take shape. Everything
// else (Read, Glob, Grep, LS, tool results) stays hidden.
const FILE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

function toolFilePath(input: unknown): string | null {
  if (input && typeof input === "object" && "file_path" in input) {
    const value = (input as { file_path?: unknown }).file_path;
    return typeof value === "string" ? value : null;
  }
  return null;
}

function toolCommand(input: unknown): string | null {
  if (input && typeof input === "object" && "command" in input) {
    const value = (input as { command?: unknown }).command;
    return typeof value === "string" ? value : null;
  }
  return null;
}

/** Show a created file relative to the project root, not its absolute path. */
function relProjectPath(absolute: string): string {
  const match = absolute.match(/\/projects\/[^/]+\/(.+)$/);
  return match ? match[1] : absolute.split("/").slice(-2).join("/");
}

/** One compact line per file the agent writes. */
function FileLine({ path }: { path: string }) {
  return (
    <div className="flex items-center gap-2 px-1 font-mono text-xs text-faint">
      <Icon name="file" size={13} />
      <span className="break-all text-muted">{path}</span>
    </div>
  );
}

/** One compact line per shell command (e.g. git init). */
function CommandLine({ command }: { command: string }) {
  return (
    <div className="flex items-center gap-2 px-1 font-mono text-xs text-faint">
      <Icon name="code" size={13} />
      <span className="break-all text-muted">{command.split("\n")[0]}</span>
    </div>
  );
}

/** Compact stand-in for the skill-load dump. */
function SkillChip() {
  return (
    <div className="flex justify-start">
      <span className="surface-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-faint">
        <Icon name="skill" size={13} />
        Using create-new-ts-project skill
      </span>
    </div>
  );
}

/** Hide the user's gate-passing seed turn and suppress fenced wizard blocks. */
function visibleText(text: string): string {
  return stripWizardBlocks(text);
}

function ChatBubble({ role, text }: { role: "assistant" | "user"; text: string }) {
  if (!text) return null;
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] break-words rounded-2xl rounded-br-md border border-accent-line bg-accent/15 px-4 py-2.5 text-sm text-ink">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="surface-2 max-w-[85%] break-words rounded-2xl rounded-bl-md px-4 py-2.5">
        <div className="eyebrow mb-1 !text-faint">Claude</div>
        <Markdown>{text}</Markdown>
      </div>
    </div>
  );
}
