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

interface ClientCommand {
  type: "user_turn";
  text: string;
}

interface Runtime {
  /** Sockets currently watching this session (zero is fine — process keeps running). */
  subscribers: Set<WebSocket>;
  /** working = producing a response; idle = alive and awaiting input. */
  state: RuntimeState;
  /** Whether the first-prompt auto-naming has been kicked off for this runtime. */
  named: boolean;
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
      runtime = { subscribers: new Set(), state: "idle", named: false };
      this.runtimes.set(sessionId, runtime);
      await SessionModel.setStatus(sessionId, "active");
      ClaudeProcessService.start(sessionId, project.path, {
        onEvent: (event) => void this.onProcessEvent(sessionId, event),
        onClose: (code) => void this.onProcessClose(sessionId, code),
        onError: (error) => {
          log.error({ sessionId, err: error }, "Process error");
          this.broadcast(sessionId, { type: "error", message: "The Claude process errored." });
        },
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
    this.safeSend(ws, { type: "ready", sessionId, state: runtime.state });
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
      if (runtime) runtime.state = "working";
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
