import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveExecutable, resolveViaPathext } from "../platform";

let binDir: string;

beforeAll(async () => {
  binDir = await fs.mkdtemp(path.join(os.tmpdir(), "platform-"));
  // A fake Windows-style command file: `claude.cmd`.
  await fs.writeFile(path.join(binDir, "claude.cmd"), "@echo off\n");
});

afterAll(async () => {
  await fs.rm(binDir, { recursive: true, force: true });
});

describe("resolveViaPathext", () => {
  it("finds a command by walking PATH × PATHEXT", () => {
    const resolved = resolveViaPathext("claude", binDir, ".CMD");
    // Extension case follows PATHEXT; the path is what matters (Windows is case-insensitive).
    expect(resolved.toLowerCase()).toBe(path.join(binDir, "claude.cmd").toLowerCase());
  });

  it("returns the bare name when no extension matches", () => {
    expect(resolveViaPathext("claude", binDir, ".EXE")).toBe("claude");
  });

  it("returns the bare name when PATH is empty", () => {
    expect(resolveViaPathext("claude", "", ".CMD")).toBe("claude");
  });

  it("leaves a name that already has an extension untouched", () => {
    expect(resolveViaPathext("claude.exe", binDir, ".CMD")).toBe("claude.exe");
  });

  it("leaves a name that is already a path untouched", () => {
    const p = path.join(binDir, "claude");
    expect(resolveViaPathext(p, binDir, ".CMD")).toBe(p);
  });

  it("falls back to the default PATHEXT list when none is provided", () => {
    expect(resolveViaPathext("claude", binDir, undefined).toLowerCase()).toBe(
      path.join(binDir, "claude.cmd").toLowerCase(),
    );
  });
});

describe("resolveExecutable", () => {
  it("returns the bare name unchanged on POSIX", () => {
    // The suite runs on POSIX CI; the win32 branch is covered via resolveViaPathext.
    if (process.platform === "win32") return;
    expect(resolveExecutable("claude")).toBe("claude");
  });
});
