import { randomUUID } from "node:crypto";
import { spawn as ptySpawn, type IPty } from "node-pty";
import { childLogger } from "../lib/logger";
import { ProjectModel } from "../models/ProjectModel";

const log = childLogger({ module: "TerminalProcessService" });

/** Hard cap on simultaneously live PTYs across all projects. */
const MAX_TERMINALS = 12;
/** Scrollback retained per terminal and replayed on (re)attach. */
const SCROLLBACK_MAX_BYTES = 256 * 1024;
/** Default geometry until the client sends its first resize. */
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

/** The shell to run; the operator's own shell, falling back per platform. */
function defaultShell(): string {
  if (process.env.SHELL) return process.env.SHELL;
  return process.platform === "win32" ? "powershell.exe" : "/bin/bash";
}

/** Typed error for the terminal layer (mirrors the domain-error pattern, §8.3). */
export class TerminalError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "TerminalError";
  }
}

/** What the WS relay subscribes with: live output + an exit notification. */
export interface TerminalSubscriber {
  onData: (data: string) => void;
  onExit: (code: number) => void;
}

/** Public metadata for the list endpoint (no pty handle). */
export interface TerminalInfo {
  id: string;
  projectId: number;
  createdAt: string;
}

interface LiveTerminal {
  id: string;
  projectId: number;
  pty: IPty;
  createdAt: string;
  /** Ring buffer of recent output, capped by SCROLLBACK_MAX_BYTES. */
  scrollback: string[];
  scrollbackBytes: number;
  subscribers: Set<TerminalSubscriber>;
  exited: boolean;
}

/**
 * Manages the lifecycle of PTY terminals — one OS pseudo-terminal per id, kept in
 * memory for the server's lifetime. Closing a WebSocket only detaches a subscriber;
 * the PTY keeps running so a browser reload can reattach and replay scrollback. All
 * PTYs are reaped on SIGINT/SIGTERM so the process never orphans children.
 *
 * The child env has ANTHROPIC_API_KEY scrubbed so `claude` in the terminal uses the
 * cached subscription login, consistent with the app's sessions (mirrors
 * ClaudeProcessService).
 */
export class TerminalProcessService {
  private static readonly live = new Map<string, LiveTerminal>();
  private static signalsBound = false;

  /** Spawn a PTY for a project and register it. Returns its public metadata. */
  static async create(projectId: number): Promise<TerminalInfo> {
    this.bindSignals();

    if (this.live.size >= MAX_TERMINALS) {
      throw new TerminalError(
        "TERMINAL_LIMIT_REACHED",
        `Too many terminals (max ${MAX_TERMINALS}). Close one and retry.`,
        { live: this.live.size },
      );
    }

    const cwd = await this.resolveProjectPath(projectId);
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    let pty: IPty;
    try {
      pty = ptySpawn(defaultShell(), [], {
        name: "xterm-256color",
        cols: DEFAULT_COLS,
        rows: DEFAULT_ROWS,
        cwd,
        env: this.buildChildEnv(),
      });
    } catch (err) {
      throw new TerminalError("TERMINAL_SPAWN_FAILED", "Failed to start the terminal.", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    const entry: LiveTerminal = {
      id,
      projectId,
      pty,
      createdAt,
      scrollback: [],
      scrollbackBytes: 0,
      subscribers: new Set(),
      exited: false,
    };
    this.live.set(id, entry);
    log.info({ terminalId: id, projectId, pid: pty.pid }, "Terminal started");

    pty.onData((data: string) => this.onData(entry, data));
    pty.onExit(({ exitCode }) => this.onExit(entry, exitCode));

    return { id, projectId, createdAt };
  }

  /** Live terminals for a project (for reattach on reload). */
  static list(projectId: number): TerminalInfo[] {
    return [...this.live.values()]
      .filter((t) => t.projectId === projectId)
      .map((t) => ({ id: t.id, projectId: t.projectId, createdAt: t.createdAt }));
  }

  /**
   * Subscribe to a terminal: the buffered scrollback is replayed immediately via
   * onData, then live output flows. Returns a detach function. Detaching does NOT
   * kill the PTY (§ persistence requirement).
   */
  static attach(terminalId: string, subscriber: TerminalSubscriber): () => void {
    const entry = this.live.get(terminalId);
    if (!entry) {
      throw new TerminalError("TERMINAL_NOT_FOUND", "No such terminal.", { terminalId });
    }
    // Replay scrollback so a reconnecting client sees recent output.
    if (entry.scrollback.length > 0) subscriber.onData(entry.scrollback.join(""));
    entry.subscribers.add(subscriber);
    return () => {
      entry.subscribers.delete(subscriber);
    };
  }

  /** Forward keystrokes/input to the PTY. */
  static write(terminalId: string, data: string): void {
    const entry = this.live.get(terminalId);
    if (!entry || entry.exited) return;
    entry.pty.write(data);
  }

  /** Resize the PTY (cols/rows) from the client's fit addon. */
  static resize(terminalId: string, cols: number, rows: number): void {
    const entry = this.live.get(terminalId);
    if (!entry || entry.exited) return;
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) return;
    try {
      entry.pty.resize(cols, rows);
    } catch (err) {
      log.warn({ terminalId, err }, "Terminal resize failed");
    }
  }

  /** Kill a terminal and drop it from the registry. */
  static kill(terminalId: string): void {
    const entry = this.live.get(terminalId);
    if (!entry) return;
    this.killEntry(entry);
  }

  // --- internals ---

  /** Append output to the ring buffer (byte-capped) and broadcast to subscribers. */
  private static onData(entry: LiveTerminal, data: string): void {
    entry.scrollback.push(data);
    entry.scrollbackBytes += Buffer.byteLength(data);
    while (entry.scrollbackBytes > SCROLLBACK_MAX_BYTES && entry.scrollback.length > 1) {
      const dropped = entry.scrollback.shift();
      if (dropped !== undefined) entry.scrollbackBytes -= Buffer.byteLength(dropped);
    }
    for (const sub of entry.subscribers) {
      try {
        sub.onData(data);
      } catch (err) {
        log.error({ terminalId: entry.id, err }, "Terminal subscriber threw; continuing");
      }
    }
  }

  private static onExit(entry: LiveTerminal, code: number): void {
    entry.exited = true;
    log.info({ terminalId: entry.id, code }, "Terminal exited");
    for (const sub of entry.subscribers) {
      try {
        sub.onExit(code);
      } catch {
        // ignore — we're tearing down
      }
    }
    this.live.delete(entry.id);
  }

  private static killEntry(entry: LiveTerminal): void {
    try {
      entry.pty.kill();
    } catch (err) {
      log.warn({ terminalId: entry.id, err }, "Failed to kill terminal");
    }
    this.live.delete(entry.id);
    log.info({ terminalId: entry.id, pid: entry.pty.pid }, "Terminal stopped");
  }

  private static killAll(): void {
    for (const entry of this.live.values()) this.killEntry(entry);
  }

  /** Build the child env with the API key scrubbed (subscription auth) + colors. */
  private static buildChildEnv(): { [key: string]: string } {
    const env: { [key: string]: string } = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === "string") env[k] = v;
    }
    delete env.ANTHROPIC_API_KEY;
    env.TERM = "xterm-256color";
    return env;
  }

  /** Resolve a project's on-disk path by id, or throw a typed error. */
  private static async resolveProjectPath(projectId: number): Promise<string> {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new TerminalError("TERMINAL_NO_PROJECT", "A valid projectId is required.");
    }
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new TerminalError("TERMINAL_PROJECT_NOT_FOUND", "Project not found.", { projectId });
    }
    return project.path;
  }

  /** Bind shutdown handlers once so PTYs are reaped on SIGINT/SIGTERM. */
  private static bindSignals(): void {
    if (this.signalsBound) return;
    this.signalsBound = true;
    const onSignal = (signal: NodeJS.Signals) => {
      log.info({ signal, live: this.live.size }, "Signal received; killing live terminals");
      this.killAll();
    };
    process.on("SIGINT", () => onSignal("SIGINT"));
    process.on("SIGTERM", () => onSignal("SIGTERM"));
  }
}
