import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectModel } from "../../models/ProjectModel";
import type { IProject } from "../../models/ProjectModel";
import { TerminalProcessService } from "../../services/TerminalProcessService";
import { attachTerminalWebSocket } from "../terminalWebSocket";

const PROJECT_ID = 1;
let server: http.Server;
let tmpDir: string;
let port: number;
const created: string[] = [];

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "term-ws-"));
  vi.spyOn(ProjectModel, "findById").mockResolvedValue({
    id: PROJECT_ID,
    name: "tmp",
    path: tmpDir,
    last_opened_at: null,
    created_at: "",
    updated_at: "",
  } as IProject);
  server = http.createServer();
  attachTerminalWebSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  for (const id of created.splice(0)) TerminalProcessService.kill(id);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.restoreAllMocks();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("terminalWebSocket", () => {
  it("streams PTY output to a connected client and accepts input", async () => {
    const info = await TerminalProcessService.create(PROJECT_ID);
    created.push(info.id);

    const out = await new Promise<string>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws/terminal?terminalId=${info.id}`);
      let buf = "";
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error(`timed out; got: ${buf.slice(-200)}`));
      }, 6000);
      ws.on("open", () => ws.send(JSON.stringify({ type: "input", data: "echo WSPTY_OK\r" })));
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString()) as { type?: string; data?: string };
        if (msg.type === "data" && msg.data) buf += msg.data;
        if (buf.includes("WSPTY_OK")) {
          clearTimeout(timer);
          ws.close();
          resolve(buf);
        }
      });
      ws.on("error", reject);
    });

    expect(out).toContain("WSPTY_OK");
  });

  it("rejects a connection without a terminalId", async () => {
    const closed = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws/terminal`);
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString()) as { type?: string };
        if (msg.type === "error") resolve(true);
      });
      ws.on("close", () => resolve(true));
      ws.on("error", () => resolve(true));
      setTimeout(() => resolve(false), 3000);
    });
    expect(closed).toBe(true);
  });
});
