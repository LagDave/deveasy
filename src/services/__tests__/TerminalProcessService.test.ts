import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectModel } from "../../models/ProjectModel";
import type { IProject } from "../../models/ProjectModel";
import { TerminalProcessService } from "../TerminalProcessService";

const PROJECT_ID = 1;
let tmpDir: string;
const created: string[] = [];

function stubProject(dir: string): void {
  vi.spyOn(ProjectModel, "findById").mockResolvedValue({
    id: PROJECT_ID,
    name: "tmp",
    path: dir,
    last_opened_at: null,
    created_at: "",
    updated_at: "",
  } as IProject);
}

/** Resolve once the accumulated output contains `marker` (or reject on timeout). */
function waitForOutput(
  attach: (sub: { onData: (d: string) => void; onExit: (c: number) => void }) => () => void,
  marker: string,
  timeoutMs = 6000,
  afterAttach?: () => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const detach = attach({
      onData: (d) => {
        buf += d;
        if (buf.includes(marker)) {
          detach();
          resolve(buf);
        }
      },
      onExit: () => {},
    });
    afterAttach?.();
    setTimeout(() => {
      detach();
      reject(new Error(`timed out waiting for "${marker}"; got: ${buf.slice(-200)}`));
    }, timeoutMs);
  });
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "term-svc-"));
  stubProject(tmpDir);
});

afterEach(async () => {
  for (const id of created.splice(0)) TerminalProcessService.kill(id);
  vi.restoreAllMocks();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("TerminalProcessService", () => {
  it("creates a terminal and lists it for the project", async () => {
    const info = await TerminalProcessService.create(PROJECT_ID);
    created.push(info.id);
    expect(info.projectId).toBe(PROJECT_ID);
    expect(typeof info.id).toBe("string");
    const list = TerminalProcessService.list(PROJECT_ID);
    expect(list.some((t) => t.id === info.id)).toBe(true);
  });

  it("runs a command and streams its output to a subscriber", async () => {
    const info = await TerminalProcessService.create(PROJECT_ID);
    created.push(info.id);
    const wait = waitForOutput(
      (sub) => TerminalProcessService.attach(info.id, sub),
      "HELLO_PTY",
    );
    TerminalProcessService.write(info.id, "echo HELLO_PTY\r");
    const out = await wait;
    expect(out).toContain("HELLO_PTY");
  });

  it("replays scrollback to a late subscriber", async () => {
    const info = await TerminalProcessService.create(PROJECT_ID);
    created.push(info.id);
    // Drive output and confirm it lands, then attach fresh — the late subscriber
    // should immediately receive the buffered scrollback.
    await waitForOutput((sub) => TerminalProcessService.attach(info.id, sub), "MARK_ONE", 6000, () =>
      TerminalProcessService.write(info.id, "echo MARK_ONE\r"),
    );
    const replay = await new Promise<string>((resolve) => {
      let buf = "";
      const detach = TerminalProcessService.attach(info.id, {
        onData: (d) => {
          buf += d;
        },
        onExit: () => {},
      });
      setTimeout(() => {
        detach();
        resolve(buf);
      }, 200);
    });
    expect(replay).toContain("MARK_ONE");
  });

  it("kill removes the terminal from the registry", async () => {
    const info = await TerminalProcessService.create(PROJECT_ID);
    TerminalProcessService.kill(info.id);
    const list = TerminalProcessService.list(PROJECT_ID);
    expect(list.some((t) => t.id === info.id)).toBe(false);
  });

  it("tags a session terminal and lists it by session and project", async () => {
    const SESSION_ID = 42;
    const plain = await TerminalProcessService.create(PROJECT_ID);
    created.push(plain.id);
    const sess = await TerminalProcessService.create(PROJECT_ID, SESSION_ID);
    created.push(sess.id);

    expect(sess.sessionId).toBe(SESSION_ID);
    expect(plain.sessionId).toBeNull();

    const bySession = TerminalProcessService.listBySession(SESSION_ID);
    expect(bySession.some((t) => t.id === sess.id)).toBe(true);
    expect(bySession.some((t) => t.id === plain.id)).toBe(false);

    // The project TERMINAL tab still sees both.
    const byProject = TerminalProcessService.list(PROJECT_ID);
    expect(byProject.some((t) => t.id === sess.id)).toBe(true);
    expect(byProject.some((t) => t.id === plain.id)).toBe(true);
  });

  it("closeForSession kills only that session's terminals", async () => {
    const SESSION_ID = 43;
    const plain = await TerminalProcessService.create(PROJECT_ID);
    created.push(plain.id);
    const sess = await TerminalProcessService.create(PROJECT_ID, SESSION_ID);
    created.push(sess.id);

    TerminalProcessService.closeForSession(SESSION_ID);

    const byProject = TerminalProcessService.list(PROJECT_ID);
    expect(byProject.some((t) => t.id === sess.id)).toBe(false); // session terminal gone
    expect(byProject.some((t) => t.id === plain.id)).toBe(true); // project terminal kept
  });

  it("throws TERMINAL_PROJECT_NOT_FOUND for a missing project", async () => {
    vi.spyOn(ProjectModel, "findById").mockResolvedValue(undefined);
    await expect(TerminalProcessService.create(PROJECT_ID)).rejects.toMatchObject({
      code: "TERMINAL_PROJECT_NOT_FOUND",
    });
  });
});
