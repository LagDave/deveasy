import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ProjectModel } from "../../../../models/ProjectModel";
import type { IProject } from "../../../../models/ProjectModel";
import { EditorError } from "../../feature-utils/EditorError";
import { MAX_TEXT_BYTES } from "../../feature-utils/fileSafety";
import { EditorService } from "../EditorService";

let tmpDir: string;
const PROJECT_ID = 1;

/** Make ProjectModel.findById return our temp dir so no DB is touched. */
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

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "editor-svc-"));
  await fs.mkdir(path.join(tmpDir, "src"), { recursive: true });
  await fs.mkdir(path.join(tmpDir, "node_modules", "pkg"), { recursive: true });
  await fs.mkdir(path.join(tmpDir, ".git"), { recursive: true });
  await fs.writeFile(path.join(tmpDir, "readme.md"), "# hello", "utf8");
  await fs.writeFile(path.join(tmpDir, "src", "index.ts"), "export const x = 1;", "utf8");
  await fs.writeFile(path.join(tmpDir, "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EditorService.listDir", () => {
  it("lists entries dirs-first and skips node_modules/.git", async () => {
    stubProject(tmpDir);
    const entries = await EditorService.listDir(PROJECT_ID, "");
    const names = entries.map((e) => e.name);
    expect(names).not.toContain("node_modules");
    expect(names).not.toContain(".git");
    // dirs sort before files
    expect(entries[0].type).toBe("dir");
    expect(entries[0].name).toBe("src");
    expect(names).toContain("readme.md");
  });

  it("throws EDITOR_PROJECT_NOT_FOUND when the project is missing", async () => {
    vi.spyOn(ProjectModel, "findById").mockResolvedValue(undefined);
    await expect(EditorService.listDir(PROJECT_ID, "")).rejects.toMatchObject({
      code: "EDITOR_PROJECT_NOT_FOUND",
    });
  });
});

describe("EditorService.readFile", () => {
  it("reads a text file as utf8", async () => {
    stubProject(tmpDir);
    const file = await EditorService.readFile(PROJECT_ID, "src/index.ts");
    expect(file.content).toBe("export const x = 1;");
    expect(file.kind).toBe("text");
    expect(file.path).toBe("src/index.ts");
  });

  it("rejects an oversized text file with EDITOR_FILE_TOO_LARGE", async () => {
    stubProject(tmpDir);
    const big = path.join(tmpDir, "big.txt");
    await fs.writeFile(big, "a".repeat(MAX_TEXT_BYTES + 1), "utf8");
    await expect(EditorService.readFile(PROJECT_ID, "big.txt")).rejects.toMatchObject({
      code: "EDITOR_FILE_TOO_LARGE",
    });
    await fs.rm(big, { force: true });
  });

  it("rejects a binary file with EDITOR_UNSUPPORTED", async () => {
    stubProject(tmpDir);
    await expect(EditorService.readFile(PROJECT_ID, "logo.png")).rejects.toMatchObject({
      code: "EDITOR_UNSUPPORTED",
    });
  });

  it("rejects a '..' escape via the guard", async () => {
    stubProject(tmpDir);
    await expect(EditorService.readFile(PROJECT_ID, "../../etc/passwd")).rejects.toMatchObject({
      code: "EDITOR_PATH_FORBIDDEN",
    });
  });
});

describe("EditorService.writeFile", () => {
  it("writes a text file and returns a savedAt timestamp", async () => {
    stubProject(tmpDir);
    const result = await EditorService.writeFile(PROJECT_ID, "src/index.ts", "export const x = 2;");
    expect(result.path).toBe("src/index.ts");
    expect(typeof result.savedAt).toBe("string");
    const onDisk = await fs.readFile(path.join(tmpDir, "src", "index.ts"), "utf8");
    expect(onDisk).toBe("export const x = 2;");
  });

  it("rejects a write that escapes the root", async () => {
    stubProject(tmpDir);
    await expect(
      EditorService.writeFile(PROJECT_ID, "../escape.txt", "x"),
    ).rejects.toBeInstanceOf(EditorError);
  });

  it("rejects writing oversized content", async () => {
    stubProject(tmpDir);
    await expect(
      EditorService.writeFile(PROJECT_ID, "src/index.ts", "a".repeat(MAX_TEXT_BYTES + 1)),
    ).rejects.toMatchObject({ code: "EDITOR_FILE_TOO_LARGE" });
  });
});

describe("error contract", () => {
  it("EditorError carries code, message, and details for the envelope", async () => {
    vi.spyOn(ProjectModel, "findById").mockResolvedValue(undefined);
    try {
      await EditorService.readFile(PROJECT_ID, "src/index.ts");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(EditorError);
      const e = err as EditorError;
      expect(e.code).toBe("EDITOR_PROJECT_NOT_FOUND");
      expect(typeof e.message).toBe("string");
      expect(e.details).toMatchObject({ projectId: PROJECT_ID });
    }
  });
});
