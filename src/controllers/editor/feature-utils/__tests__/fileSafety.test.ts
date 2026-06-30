import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EditorError } from "../EditorError";
import { assertRelativePathShape, classifyFile, contentTypeFor, resolveSafePath } from "../fileSafety";

let root: string;
let outside: string;

beforeAll(async () => {
  // realpath so comparisons hold on platforms where tmpdir is a symlink (macOS /var).
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "editor-root-")));
  outside = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "editor-outside-")));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(path.join(root, "src", "index.ts"), "export {};", "utf8");
  await fs.writeFile(path.join(outside, "secret.txt"), "top secret", "utf8");
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(outside, { recursive: true, force: true });
});

describe("resolveSafePath", () => {
  it("resolves a normal nested path inside the root", async () => {
    const result = await resolveSafePath(root, "src/index.ts");
    expect(result.absPath).toBe(path.join(root, "src", "index.ts"));
    expect(result.relPath).toBe("src/index.ts");
  });

  it("treats empty path as the root", async () => {
    const result = await resolveSafePath(root, "");
    expect(result.absPath).toBe(path.resolve(root));
    expect(result.relPath).toBe("");
  });

  it("rejects an absolute path", async () => {
    await expect(resolveSafePath(root, "/etc/passwd")).rejects.toMatchObject({
      code: "EDITOR_PATH_FORBIDDEN",
    });
  });

  it("rejects a '..' traversal escape", async () => {
    await expect(resolveSafePath(root, "../../etc/passwd")).rejects.toMatchObject({
      code: "EDITOR_PATH_FORBIDDEN",
    });
  });

  it("rejects a nested '..' segment", async () => {
    await expect(resolveSafePath(root, "src/../../escape")).rejects.toBeInstanceOf(EditorError);
  });

  it("rejects a symlink that points outside the root", async () => {
    const linkPath = path.join(root, "escape-link");
    try {
      await fs.symlink(outside, linkPath, "dir");
    } catch {
      // Some environments disallow symlinks; skip rather than fail spuriously.
      return;
    }
    await expect(resolveSafePath(root, "escape-link/secret.txt")).rejects.toMatchObject({
      code: "EDITOR_PATH_OUTSIDE_ROOT",
    });
  });

  it("blocks writes under a .git segment", async () => {
    await expect(
      resolveSafePath(root, ".git/config", { forWrite: true }),
    ).rejects.toMatchObject({ code: "EDITOR_PATH_FORBIDDEN" });
  });

  it("rejects a WRITE to an existing file that is a symlink pointing outside the root", async () => {
    const linkPath = path.join(root, "link-out.txt");
    try {
      await fs.symlink(path.join(outside, "secret.txt"), linkPath, "file");
    } catch {
      return; // symlinks unavailable — skip
    }
    // The write target itself is a symlink to outside: must be rejected (not just the parent).
    await expect(
      resolveSafePath(root, "link-out.txt", { forWrite: true }),
    ).rejects.toMatchObject({ code: "EDITOR_PATH_OUTSIDE_ROOT" });
    await fs.rm(linkPath, { force: true });
  });

  it("refuses to write THROUGH a final-component symlink even when it resolves inside the root", async () => {
    const linkPath = path.join(root, "link-in.txt");
    try {
      await fs.symlink(path.join(root, "src", "index.ts"), linkPath, "file");
    } catch {
      return; // symlinks unavailable — skip
    }
    await expect(
      resolveSafePath(root, "link-in.txt", { forWrite: true }),
    ).rejects.toMatchObject({ code: "EDITOR_PATH_FORBIDDEN" });
    // The same in-root symlink is fine to READ through.
    await expect(resolveSafePath(root, "link-in.txt")).resolves.toBeTruthy();
    await fs.rm(linkPath, { force: true });
  });
});

describe("assertRelativePathShape", () => {
  it("accepts a normal nested relative path", () => {
    expect(() => assertRelativePathShape("src/index.ts")).not.toThrow();
  });

  it("rejects an empty path", () => {
    expect(() => assertRelativePathShape("")).toThrow(EditorError);
  });

  it("rejects an absolute path", () => {
    expect(() => assertRelativePathShape("/etc/passwd")).toThrow(EditorError);
  });

  it("rejects a '..' segment", () => {
    expect(() => assertRelativePathShape("src/../../escape")).toThrow(EditorError);
  });

  it("does NOT touch the filesystem (a symlinked name passes shape validation)", () => {
    // Unlike resolveSafePath, this is lexical only — a path that is a symlink on disk
    // is fine to persist as a bookmark; the fs guard runs at read/write time.
    expect(() => assertRelativePathShape("CLAUDE.md")).not.toThrow();
  });
});

describe("classifyFile", () => {
  it.each([
    ["a.ts", "text"],
    ["a.json", "text"],
    ["a.unknownext", "text"],
    ["a.PNG", "image"],
    ["photo.jpeg", "image"],
    ["icon.svg", "image"],
    ["doc.pdf", "pdf"],
    ["page.html", "html"],
    ["page.htm", "html"],
  ])("classifies %s as %s", (name, kind) => {
    expect(classifyFile(name)).toBe(kind);
  });
});

describe("contentTypeFor", () => {
  it("maps known extensions to MIME types", () => {
    expect(contentTypeFor("a.png")).toBe("image/png");
    expect(contentTypeFor("a.pdf")).toBe("application/pdf");
  });

  it("falls back to octet-stream for unknown extensions", () => {
    expect(contentTypeFor("a.bin")).toBe("application/octet-stream");
  });
});
