import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { childLogger } from "../lib/logger";

const log = childLogger({ module: "ClaudeProcessService" });

/** Hard cap on simultaneously live CLI processes (Spec 2: one process per session). */
const MAX_CONCURRENT_SESSIONS = 8;

/** The CLI binary and the structured-streaming arg set, per Spec 2. */
const CLI_COMMAND = "claude";
const CLI_ARGS = [
  "-p",
  "--output-format",
  "stream-json",
  "--input-format",
  "stream-json",
  "--verbose",
] as const;

/** Timeout for the install/login precondition probe. */
const PROBE_TIMEOUT_MS = 5_000;

/**
 * A parsed Claude stream-json event. The CLI schema can drift, so we keep this
 * permissive (an object with a string `type`) and never assume a fixed shape —
 * unknown events still flow through to the client untouched (§ risk: schema drift).
 */
export interface ClaudeStreamEvent {
  type: string;
  [key: string]: unknown;
}

/** Typed error for the process layer (mirrors the domain-error pattern, §8.3). */
export class ClaudeProcessError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "ClaudeProcessError";
  }
}

type EventHandler = (event: ClaudeStreamEvent) => void;
type CloseHandler = (code: number | null) => void;
type ErrorHandler = (error: Error) => void;

interface SessionHandlers {
  onEvent: EventHandler;
  onClose: CloseHandler;
  onError: ErrorHandler;
}

interface LiveProcess {
  child: ChildProcessWithoutNullStreams;
  stdoutBuffer: string;
  handlers: SessionHandlers;
}

/**
 * Manages the lifecycle of `claude` CLI child processes — one per session.
 *
 * Critically, the child env has ANTHROPIC_API_KEY scrubbed so the cached
 * subscription login is used instead of pay-as-you-go API credits (§ risk:
 * wrong auth mode). Worker-style discipline: idempotent start, clean teardown,
 * failures logged with context (§21 spirit).
 */
export class ClaudeProcessService {
  /** In-memory PID registry keyed by sessionId. */
  private static readonly live = new Map<number, LiveProcess>();
  private static signalsBound = false;

  /**
   * Probe that the CLI is installed and logged in. Surfaces a typed
   * SESSION_CLI_NOT_READY error if not, so the UI can prompt `claude` login.
   */
  static assertReady(): void {
    let probe: ReturnType<typeof spawnSync>;
    try {
      probe = spawnSync(CLI_COMMAND, ["--version"], {
        timeout: PROBE_TIMEOUT_MS,
        encoding: "utf8",
        env: this.buildChildEnv(),
      });
    } catch (err) {
      throw new ClaudeProcessError(
        "SESSION_CLI_NOT_READY",
        "The Claude CLI could not be launched. Install it and run `claude` to log in.",
        { err: err instanceof Error ? err.message : String(err) },
      );
    }

    if (probe.error || probe.status !== 0) {
      throw new ClaudeProcessError(
        "SESSION_CLI_NOT_READY",
        "The Claude CLI is not installed or not logged in. Run `claude` to log in first.",
        { status: probe.status, stderr: probe.stderr?.toString().slice(0, 500) ?? null },
      );
    }
  }

  /**
   * Spawn a CLI process for a session against the given project path. Idempotent:
   * a second start for a live session returns without spawning a duplicate.
   */
  static start(sessionId: number, projectPath: string, handlers: SessionHandlers): void {
    this.bindSignals();

    if (this.live.has(sessionId)) {
      log.warn({ sessionId }, "start() called for an already-live session; ignoring");
      return;
    }
    if (this.live.size >= MAX_CONCURRENT_SESSIONS) {
      throw new ClaudeProcessError(
        "SESSION_LIMIT_REACHED",
        `Too many live sessions (max ${MAX_CONCURRENT_SESSIONS}). Close one and retry.`,
        { live: this.live.size },
      );
    }

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(CLI_COMMAND, [...CLI_ARGS], {
        cwd: projectPath,
        env: this.buildChildEnv(),
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      throw new ClaudeProcessError(
        "SESSION_SPAWN_FAILED",
        "Failed to spawn the Claude CLI process.",
        { sessionId, err: err instanceof Error ? err.message : String(err) },
      );
    }

    const entry: LiveProcess = { child, stdoutBuffer: "", handlers };
    this.live.set(sessionId, entry);
    log.info({ sessionId, pid: child.pid, projectPath }, "Claude process started");

    this.wireProcess(sessionId, entry);
  }

  /** Write a user turn to the process stdin as a stream-json line. */
  static send(sessionId: number, text: string): void {
    const entry = this.live.get(sessionId);
    if (!entry) {
      throw new ClaudeProcessError(
        "SESSION_NOT_LIVE",
        "No live process for this session. Start it before sending a turn.",
        { sessionId },
      );
    }

    const turn = {
      type: "user",
      message: { role: "user", content: [{ type: "text", text }] },
    };
    try {
      entry.child.stdin.write(`${JSON.stringify(turn)}\n`);
    } catch (err) {
      const wrapped = new ClaudeProcessError(
        "SESSION_WRITE_FAILED",
        "Failed to write the user turn to the process.",
        { sessionId, err: err instanceof Error ? err.message : String(err) },
      );
      log.error({ sessionId, err }, "stdin write failed");
      throw wrapped;
    }
  }

  /** Kill the process for a session and drop it from the registry. */
  static stop(sessionId: number): void {
    const entry = this.live.get(sessionId);
    if (!entry) return;
    this.killEntry(sessionId, entry);
  }

  /** True if a live process exists for the session. */
  static isLive(sessionId: number): boolean {
    return this.live.has(sessionId);
  }

  /** Session ids that currently have a live CLI process (for the "running" indicator). */
  static getLiveSessionIds(): number[] {
    return [...this.live.keys()];
  }

  /**
   * Run a single headless prompt and return the plain-text response. Uses the same
   * subscription-auth env (API key scrubbed). For short utility calls like session
   * auto-naming — not the interactive session loop.
   */
  static runHeadless(prompt: string, timeoutMs = 20_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(CLI_COMMAND, ["-p", prompt], {
        env: this.buildChildEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        timeout: timeoutMs,
      });
      let out = "";
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (c: string) => (out += c));
      child.on("error", (err) => reject(err));
      child.on("close", (code) => {
        if (code === 0) resolve(out);
        else reject(new ClaudeProcessError("HEADLESS_FAILED", "Headless CLI call failed.", { code }));
      });
    });
  }

  // --- internals ---

  /** Build the child env with the API key scrubbed (subscription auth, critical). */
  private static buildChildEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    return env;
  }

  private static wireProcess(sessionId: number, entry: LiveProcess): void {
    const { child, handlers } = entry;

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      this.consumeStdout(sessionId, entry, chunk);
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      // stderr is diagnostic noise, not transcript content — log, don't crash.
      log.warn({ sessionId, stderr: chunk.slice(0, 500) }, "Claude process stderr");
    });

    child.on("error", (err) => {
      log.error({ sessionId, err }, "Claude process error");
      this.live.delete(sessionId);
      handlers.onError(err);
    });

    child.on("close", (code) => {
      log.info({ sessionId, code }, "Claude process closed");
      this.live.delete(sessionId);
      handlers.onClose(code);
    });
  }

  /**
   * Line-buffer stdout into complete NDJSON lines and parse each. Malformed lines
   * are dropped and logged rather than crashing the stream (§ risk: partial NDJSON).
   */
  private static consumeStdout(sessionId: number, entry: LiveProcess, chunk: string): void {
    entry.stdoutBuffer += chunk;
    const lines = entry.stdoutBuffer.split("\n");
    entry.stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed: ClaudeStreamEvent;
      try {
        parsed = JSON.parse(trimmed) as ClaudeStreamEvent;
      } catch {
        log.warn({ sessionId, line: trimmed.slice(0, 200) }, "Dropped malformed stream-json line");
        continue;
      }
      try {
        entry.handlers.onEvent(parsed);
      } catch (err) {
        // A consumer fault must not take down the process loop.
        log.error({ sessionId, err }, "Event handler threw; continuing stream");
      }
    }
  }

  private static killEntry(sessionId: number, entry: LiveProcess): void {
    try {
      entry.child.kill("SIGTERM");
    } catch (err) {
      log.warn({ sessionId, err }, "Failed to kill child process");
    }
    this.live.delete(sessionId);
    log.info({ sessionId, pid: entry.child.pid }, "Claude process stopped");
  }

  /** Kill every live child — used on shutdown to prevent orphans. */
  private static killAll(): void {
    for (const [sessionId, entry] of this.live) {
      this.killEntry(sessionId, entry);
    }
  }

  /** Bind shutdown handlers once so children are reaped on SIGINT/SIGTERM. */
  private static bindSignals(): void {
    if (this.signalsBound) return;
    this.signalsBound = true;
    const onSignal = (signal: NodeJS.Signals) => {
      log.info({ signal, live: this.live.size }, "Signal received; killing live Claude processes");
      this.killAll();
    };
    process.on("SIGINT", () => onSignal("SIGINT"));
    process.on("SIGTERM", () => onSignal("SIGTERM"));
  }
}
