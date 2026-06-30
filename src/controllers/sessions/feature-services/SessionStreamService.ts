import type { WebSocket } from "ws";
import { childLogger } from "../../../lib/logger";
import { ProjectModel } from "../../../models/ProjectModel";
import { SessionMessageModel, type MessageRole } from "../../../models/SessionMessageModel";
import { SessionModel } from "../../../models/SessionModel";
import {
  ClaudeProcessService,
  type ClaudeStreamEvent,
} from "../../../services/ClaudeProcessService";
import { SessionTitleService } from "../../../services/SessionTitleService";
import { SessionError } from "../feature-utils/SessionError";

const log = childLogger({ module: "SessionStreamService" });

/** Runtime status of a live session, surfaced to the sidebar indicator. */
export type RuntimeState = "working" | "idle";

type ClientCommand =
  | { type: "user_turn"; text: string }
  | { type: "set_model"; model: string | null };

/** Live capabilities of a session, captured from the CLI `init` event. */
interface Capabilities {
  model: string | null;
  slashCommands: string[];
  skills: unknown[];
}

interface Runtime {
  /** Sockets currently watching this session (zero is fine — process keeps running). */
  subscribers: Set<WebSocket>;
  /** working = producing a response; idle = alive and awaiting input. */
  state: RuntimeState;
  /** Whether the first-prompt auto-naming has been kicked off for this runtime. */
  named: boolean;
  /** Project path — kept so a model switch can restart the process in place. */
  projectPath: string;
  /** The CLI's pinned session id, used to --resume on a model switch. */
  cliSessionId: string;
  /** Currently selected model (null = CLI default). */
  model: string | null;
  /** True once a turn has been sent — i.e. the CLI has a conversation to --resume. */
  hasConversation: boolean;
  /** Latest capabilities from the init event, replayed to late-attaching sockets. */
  capabilities: Capabilities | null;
  /** Latest context-window usage, replayed to late-attaching sockets. */
  context: { used: number; window: number } | null;
}

/**
 * Owns the runtime of chat sessions. The CLI process lives here independently of
 * any WebSocket: switching away (socket close) only detaches a subscriber — it
 * never kills the process. A reconnecting socket re-attaches to the running
 * process and resumes receiving events; the transcript is always persisted, even
 * with zero watchers. This is the long-running-process model the feature needs —
 * no job queue, because a session is interactive, not a run-to-completion job.
 */
export class SessionStreamService {
  /** Live session runtimes keyed by sessionId. Absent = no live process. */
  private static readonly runtimes = new Map<number, Runtime>();

  /** Runtime state for one session (null when not live) — for the list indicator. */
  static getRuntimeState(sessionId: number): RuntimeState | null {
    return this.runtimes.get(sessionId)?.state ?? null;
  }

  /** All live runtime states, for annotating the session list. */
  static getRuntimeStates(): Map<number, RuntimeState> {
    const out = new Map<number, RuntimeState>();
    for (const [id, rt] of this.runtimes) out.set(id, rt.state);
    return out;
  }

  /**
   * Attach a socket to a session. Starts the CLI process on first attach; later
   * attaches just subscribe to the already-running process.
   */
  static async attach(ws: WebSocket, sessionId: number): Promise<void> {
    const session = await SessionModel.findById(sessionId);
    if (!session) throw new SessionError("SESSION_NOT_FOUND", "Session not found.", { sessionId });

    const project = await ProjectModel.findById(session.project_id);
    if (!project) {
      throw new SessionError("PROJECT_NOT_FOUND", "Project for session not found.", {
        sessionId,
        projectId: session.project_id,
      });
    }

    let runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      ClaudeProcessService.assertReady(); // throws SESSION_CLI_NOT_READY if logged out
      // Pin our own CLI session id so a later model switch can --resume this exact
      // conversation; persist it so it survives a process restart.
      const cliSessionId = ClaudeProcessService.newCliSessionId();
      runtime = {
        subscribers: new Set(),
        state: "idle",
        named: false,
        projectPath: project.path,
        cliSessionId,
        model: session.model,
        hasConversation: false,
        capabilities: null,
        context: null,
      };
      this.runtimes.set(sessionId, runtime);
      await SessionModel.setStatus(sessionId, "active");
      await SessionModel.setCliSessionId(sessionId, cliSessionId);
      ClaudeProcessService.start(sessionId, project.path, this.handlersFor(sessionId), {
        model: session.model,
        cliSessionId,
      });
      log.info({ sessionId }, "Session process started");
    }

    runtime.subscribers.add(ws);

    ws.on("message", (raw) => void this.handleClientMessage(ws, sessionId, raw.toString()));
    ws.on("close", () => {
      this.runtimes.get(sessionId)?.subscribers.delete(ws);
      log.info({ sessionId }, "WS detached; process kept alive");
    });
    ws.on("error", () => {
      this.runtimes.get(sessionId)?.subscribers.delete(ws);
    });

    // Tell the client the current state so a reattach to a busy session shows it.
    this.safeSend(ws, { type: "ready", sessionId, state: runtime.state, model: runtime.model });
    // Replay known capabilities/context to a socket that attached after init fired.
    if (runtime.capabilities) {
      this.safeSend(ws, { type: "capabilities", sessionId, ...runtime.capabilities });
    }
    if (runtime.context) {
      this.safeSend(ws, { type: "context", sessionId, ...runtime.context });
    }
  }

  /** The process handlers for a session — shared by start and model-switch restart. */
  private static handlersFor(sessionId: number) {
    return {
      onEvent: (event: ClaudeStreamEvent) => void this.onProcessEvent(sessionId, event),
      onClose: (code: number | null) => void this.onProcessClose(sessionId, code),
      onError: (error: Error) => {
        log.error({ sessionId, err: error }, "Process error");
        this.broadcast(sessionId, { type: "error", message: "The Claude process errored." });
      },
    };
  }

  /**
   * Switch the session's model: persist it, then restart the CLI process resumed so
   * the conversation context carries over. Only allowed when idle — never mid-turn.
   */
  static async setModel(sessionId: number, model: string | null): Promise<void> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      throw new SessionError("SESSION_NOT_LIVE", "Session is not live.", { sessionId });
    }
    if (runtime.state !== "idle") {
      throw new SessionError(
        "SESSION_BUSY",
        "Finish the current turn before switching models.",
        { sessionId },
      );
    }
    runtime.model = model;
    await SessionModel.setModel(sessionId, model);

    // Resume only when the CLI actually has a conversation under this id; resuming
    // an unused id fails with "No conversation found". Before the first turn there
    // is nothing to preserve, so start fresh under a new id instead.
    let resume = runtime.hasConversation;
    if (!resume) {
      runtime.cliSessionId = ClaudeProcessService.newCliSessionId();
      await SessionModel.setCliSessionId(sessionId, runtime.cliSessionId);
    }
    ClaudeProcessService.restart(sessionId, runtime.projectPath, this.handlersFor(sessionId), {
      model,
      cliSessionId: runtime.cliSessionId,
      resume,
    });
    log.info({ sessionId, model, resume }, "Session model switched");
  }

  /** Explicitly end a session: kill the process (triggers cleanup) and mark closed. */
  static stop(sessionId: number): void {
    ClaudeProcessService.stop(sessionId); // fires onClose -> onProcessClose cleanup
    if (!ClaudeProcessService.isLive(sessionId)) {
      this.runtimes.delete(sessionId);
      void SessionModel.setStatus(sessionId, "closed").catch((err) =>
        log.error({ sessionId, err }, "Failed to mark session closed"),
      );
    }
  }

  // --- internals ---

  private static async handleClientMessage(ws: WebSocket, sessionId: number, raw: string): Promise<void> {
    let command: ClientCommand;
    try {
      command = JSON.parse(raw) as ClientCommand;
    } catch {
      this.safeSend(ws, { type: "error", message: "Malformed command." });
      return;
    }

    if (command.type === "set_model") {
      try {
        await this.setModel(sessionId, command.model ?? null);
      } catch (err) {
        const message =
          err instanceof SessionError ? err.message : "Could not switch model.";
        log.error({ sessionId, err }, "set_model failed");
        this.safeSend(ws, { type: "error", message });
      }
      return;
    }

    if (command.type !== "user_turn" || typeof command.text !== "string") {
      this.safeSend(ws, { type: "error", message: "Unsupported command." });
      return;
    }

    try {
      await SessionMessageModel.create({
        sessionId,
        role: "user",
        eventType: "user_turn",
        content: { text: command.text },
      });
      const runtime = this.runtimes.get(sessionId);
      if (runtime) {
        runtime.state = "working";
        // A turn now exists, so a later model switch can safely --resume this id.
        runtime.hasConversation = true;
      }
      ClaudeProcessService.send(sessionId, command.text);

      // Auto-name the session from its first prompt (fire-and-forget).
      if (runtime && !runtime.named) {
        runtime.named = true;
        void SessionTitleService.generateFromFirstPrompt(sessionId, command.text);
      }
    } catch (err) {
      log.error({ sessionId, err }, "Failed to handle user turn");
      this.safeSend(ws, { type: "error", message: "Could not send your message." });
    }
  }

  private static async onProcessEvent(sessionId: number, event: ClaudeStreamEvent): Promise<void> {
    const runtime = this.runtimes.get(sessionId);
    // Drive state from the actual stream: a `result` ends the turn (idle/awaiting
    // input); any assistant/tool/partial activity means it's actively working.
    if (runtime) {
      if (event.type === "result") runtime.state = "idle";
      else if (event.type === "assistant" || event.type === "user" || event.type === "stream_event") {
        runtime.state = "working";
      }
    }

    // Derive live controls from the stream and relay them as synthetic events
    // (not persisted — they are re-derived whenever the session is live).
    if (event.type === "system" && event.subtype === "init") {
      this.captureCapabilities(sessionId, event);
    } else if (event.type === "result") {
      this.captureContext(sessionId, event);
    }

    // Always relay so the UI streams live. Partial `stream_event` chunks are
    // transient token deltas — relay them but do NOT persist (the final assistant
    // message is persisted below and is what history replays).
    this.broadcast(sessionId, event);
    if (event.type === "stream_event") return;

    try {
      await SessionMessageModel.create({
        sessionId,
        role: this.roleForEvent(event),
        eventType: typeof event.type === "string" ? event.type : "unknown",
        content: event,
      });
    } catch (err) {
      log.error({ sessionId, eventType: event.type, err }, "Failed to persist stream event");
    }
  }

  private static async onProcessClose(sessionId: number, code: number | null): Promise<void> {
    this.broadcast(sessionId, { type: "process_closed", code });
    this.runtimes.delete(sessionId);
    try {
      await SessionModel.setStatus(sessionId, "closed");
    } catch (err) {
      log.error({ sessionId, err }, "Failed to mark session closed on process close");
    }
  }

  /** Pull capabilities (model, slash commands, skills) out of an init event. */
  private static captureCapabilities(sessionId: number, event: ClaudeStreamEvent): void {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) return;
    const model = typeof event.model === "string" ? event.model : null;
    const slashCommands = Array.isArray(event.slash_commands)
      ? (event.slash_commands.filter((c) => typeof c === "string") as string[])
      : [];
    const skills = Array.isArray(event.skills) ? (event.skills as unknown[]) : [];
    runtime.capabilities = { model, slashCommands, skills };
    if (model) runtime.model = model;
    this.broadcast(sessionId, { type: "capabilities", sessionId, model, slashCommands, skills });
    this.broadcast(sessionId, { type: "model_updated", sessionId, model });
  }

  /** Derive context-window usage from a result event's token counts. */
  private static captureContext(sessionId: number, event: ClaudeStreamEvent): void {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) return;
    const usage = (event.usage ?? {}) as Record<string, unknown>;
    const num = (v: unknown): number => (typeof v === "number" ? v : 0);
    const used =
      num(usage.input_tokens) +
      num(usage.cache_read_input_tokens) +
      num(usage.cache_creation_input_tokens);
    // contextWindow lives on the per-model usage map; take the first entry's value.
    const modelUsage = (event.modelUsage ?? {}) as Record<string, { contextWindow?: unknown }>;
    const first = Object.values(modelUsage)[0];
    const window = first && typeof first.contextWindow === "number" ? first.contextWindow : 0;
    if (window <= 0) return;
    runtime.context = { used, window };
    this.broadcast(sessionId, { type: "context", sessionId, used, window });
  }

  /** Fan an event out to every socket currently watching the session. */
  private static broadcast(sessionId: number, payload: unknown): void {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) return;
    for (const ws of runtime.subscribers) this.safeSend(ws, payload);
  }

  private static roleForEvent(event: ClaudeStreamEvent): MessageRole {
    if (event.type === "assistant") return "assistant";
    if (event.type === "user") return "user";
    return "system";
  }

  private static safeSend(ws: WebSocket, payload: unknown): void {
    try {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
    } catch (err) {
      log.warn({ err }, "Failed to send to WS client");
    }
  }
}
