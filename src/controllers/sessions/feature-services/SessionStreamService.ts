import type { WebSocket } from "ws";
import { childLogger } from "../../../lib/logger";
import { ProjectModel } from "../../../models/ProjectModel";
import { SessionMessageModel, type MessageRole } from "../../../models/SessionMessageModel";
import { SessionModel } from "../../../models/SessionModel";
import {
  ClaudeProcessService,
  type ClaudeStreamEvent,
} from "../../../services/ClaudeProcessService";
import { SessionError } from "../feature-utils/SessionError";

const log = childLogger({ module: "SessionStreamService" });

/** Shape of a message sent by the browser over the WebSocket. */
interface ClientCommand {
  type: "user_turn";
  text: string;
}

/**
 * Bridges one WS client to one ClaudeProcessService session, persisting each
 * streamed event via the models as it flows (Constitution §7.1: services own the
 * orchestration, models own the DB). Business logic only — never touches req/res.
 */
export class SessionStreamService {
  /**
   * Attach a connected WebSocket to a session: resolve the project, spawn the CLI,
   * and wire the bidirectional bridge. Throws SessionError on bad preconditions.
   */
  static async bridge(ws: WebSocket, sessionId: number): Promise<void> {
    const session = await SessionModel.findById(sessionId);
    if (!session) {
      throw new SessionError("SESSION_NOT_FOUND", "Session not found.", { sessionId });
    }

    const project = await ProjectModel.findById(session.project_id);
    if (!project) {
      throw new SessionError("PROJECT_NOT_FOUND", "Project for session not found.", {
        sessionId,
        projectId: session.project_id,
      });
    }

    // Surfaces SESSION_CLI_NOT_READY if the CLI is missing or logged out.
    ClaudeProcessService.assertReady();

    ClaudeProcessService.start(sessionId, project.path, {
      onEvent: (event) => {
        void this.handleEvent(ws, sessionId, event);
      },
      onClose: (code) => {
        void this.handleClose(ws, sessionId, code);
      },
      onError: (error) => {
        log.error({ sessionId, err: error }, "Process error relayed to client");
        this.safeSend(ws, { type: "error", message: "The Claude process errored." });
      },
    });

    ws.on("message", (raw) => {
      void this.handleClientMessage(ws, sessionId, raw.toString());
    });

    ws.on("close", () => {
      log.info({ sessionId }, "WS closed; stopping process");
      ClaudeProcessService.stop(sessionId);
      void SessionModel.setStatus(sessionId, "closed").catch((err) => {
        log.error({ sessionId, err }, "Failed to mark session closed");
      });
    });

    ws.on("error", (err) => {
      log.error({ sessionId, err }, "WS error; stopping process");
      ClaudeProcessService.stop(sessionId);
    });

    this.safeSend(ws, { type: "ready", sessionId });
  }

  private static async handleClientMessage(
    ws: WebSocket,
    sessionId: number,
    raw: string,
  ): Promise<void> {
    let command: ClientCommand;
    try {
      command = JSON.parse(raw) as ClientCommand;
    } catch {
      log.warn({ sessionId }, "Dropped malformed client command");
      this.safeSend(ws, { type: "error", message: "Malformed command." });
      return;
    }

    if (command.type !== "user_turn" || typeof command.text !== "string") {
      this.safeSend(ws, { type: "error", message: "Unsupported command." });
      return;
    }

    try {
      // Persist the user turn (content in DB, only identifiers logged — §5.3).
      await SessionMessageModel.create({
        sessionId,
        role: "user",
        eventType: "user_turn",
        content: { text: command.text },
      });
      log.info({ sessionId }, "User turn persisted; forwarding to process");
      ClaudeProcessService.send(sessionId, command.text);
    } catch (err) {
      log.error({ sessionId, err }, "Failed to handle user turn");
      this.safeSend(ws, { type: "error", message: "Could not send your message." });
    }
  }

  private static async handleEvent(
    ws: WebSocket,
    sessionId: number,
    event: ClaudeStreamEvent,
  ): Promise<void> {
    // Relay first so the UI stays live, then persist (§ never lose a streamed event).
    this.safeSend(ws, event);
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

  private static async handleClose(
    ws: WebSocket,
    sessionId: number,
    code: number | null,
  ): Promise<void> {
    this.safeSend(ws, { type: "process_closed", code });
    try {
      await SessionModel.setStatus(sessionId, "closed");
    } catch (err) {
      log.error({ sessionId, err }, "Failed to mark session closed on process close");
    }
  }

  private static roleForEvent(event: ClaudeStreamEvent): MessageRole {
    if (event.type === "assistant") return "assistant";
    if (event.type === "user") return "user";
    return "system";
  }

  /** Send JSON to the client, tolerating a closed socket. */
  private static safeSend(ws: WebSocket, payload: unknown): void {
    try {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
    } catch (err) {
      log.warn({ err }, "Failed to send to WS client");
    }
  }
}
