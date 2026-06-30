import fs from "node:fs/promises";
import path from "node:path";
import { EditorError } from "./EditorError";

/**
 * The path-safety core for the editor domain. EVERY filesystem access in the
 * editor goes through resolveSafePath so traversal and symlink-escape are blocked
 * in one place (Constitution §5.2, §5.4). Built on the same boundary-check pattern
 * as services/PathGuard.ts.
 */

/** Directories never listed or descended into (Constitution §4.2 — named, not magic). */
export const IGNORED_DIR_NAMES: readonly string[] = [".git", "node_modules"];

/** Max bytes for a text read or write; larger files return EDITOR_FILE_TOO_LARGE (§2.4, §4.2). */
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;

/** Max bytes streamed by the raw endpoint (images, PDFs); larger return EDITOR_FILE_TOO_LARGE. */
export const MAX_RAW_BYTES = 25 * 1024 * 1024;

export type FileKind = "text" | "image" | "pdf" | "html";

/** Extension (no dot, lowercase) → file kind. Anything unmapped is treated as text. */
const EXTENSION_KIND: Readonly<Record<string, FileKind>> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  svg: "image",
  webp: "image",
  bmp: "image",
  ico: "image",
  pdf: "pdf",
  html: "html",
  htm: "html",
};

/** Extension → MIME type for the raw stream's Content-Type header. */
const CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  pdf: "application/pdf",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
};

/** Lowercase extension without the leading dot, or "" when there is none. */
function extensionOf(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ext.startsWith(".") ? ext.slice(1) : ext;
}

/** Classify a file by extension into the four viewer kinds (§4.2). */
export function classifyFile(name: string): FileKind {
  return EXTENSION_KIND[extensionOf(name)] ?? "text";
}

/** MIME type for raw streaming; defaults to a safe binary type for unknown kinds. */
export function contentTypeFor(name: string): string {
  return CONTENT_TYPE_BY_EXTENSION[extensionOf(name)] ?? "application/octet-stream";
}

/** True when the relative path has a `.git` segment — writes there are blocked. */
function hasGitSegment(relPath: string): boolean {
  return relPath
    .split(/[\\/]/)
    .some((segment) => segment === ".git");
}

/**
 * Lexical-only path check (no filesystem access): reject empty, absolute, and
 * `..`-containing paths. Used to validate PERSISTED tab paths, which are UI
 * bookmarks — the authoritative guard (incl. the symlink realpath check in
 * resolveSafePath) still runs whenever a file is actually read or written, so
 * this never relaxes filesystem safety; it only avoids hard-failing persistence
 * when an open tab happens to be a symlink (e.g. DevEasy's injected config).
 */
export function assertRelativePathShape(relPath: string): void {
  const raw = (relPath ?? "").trim();
  if (raw.length === 0) {
    throw new EditorError("EDITOR_PATH_FORBIDDEN", "Empty path is not allowed.", { relPath });
  }
  if (path.isAbsolute(raw)) {
    throw new EditorError("EDITOR_PATH_FORBIDDEN", "Absolute paths are not allowed.", { relPath });
  }
  if (raw.split(/[\\/]/).some((segment) => segment === "..")) {
    throw new EditorError("EDITOR_PATH_FORBIDDEN", "Path traversal is not allowed.", { relPath });
  }
}

/** Assert an absolute path is the root itself or strictly inside it (§5.2 boundary check). */
function assertInsideRoot(root: string, absolutePath: string): void {
  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(absolutePath);
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    throw new EditorError("EDITOR_PATH_OUTSIDE_ROOT", "Path escapes the project root.", {
      relPath: absolutePath,
    });
  }
}

/** Realpath a path that may not exist; returns null if the target is absent. */
async function realpathIfExists(target: string): Promise<string | null> {
  try {
    return await fs.realpath(target);
  } catch {
    return null;
  }
}

/** lstat a path that may not exist; returns null if absent. Does NOT follow symlinks. */
async function lstatIfExists(target: string) {
  try {
    return await fs.lstat(target);
  } catch {
    return null;
  }
}

export interface SafePath {
  /** Absolute, validated on-disk path. */
  absPath: string;
  /** The normalized relative path (posix-style separators). */
  relPath: string;
}

/**
 * Resolve a client-supplied relative path against a trusted project root and prove
 * it cannot escape (Constitution §5.2, §5.4):
 *   1. reject absolute paths and any `..` segment;
 *   2. resolve against root and assert the result is inside root;
 *   3. fs.realpath the resolved TARGET (when it exists) and assert it is STILL
 *      inside root — this rejects an existing file that is a symlink pointing out,
 *      for both reads and writes; for a not-yet-existing write target, fall back to
 *      proving the PARENT dir resolves inside root;
 *   4. for writes, additionally refuse to write THROUGH a final-component symlink
 *      (even one resolving inside root) and block any path under a `.git/` segment.
 */
export async function resolveSafePath(
  root: string,
  relPath: string,
  options: { forWrite?: boolean } = {},
): Promise<SafePath> {
  // Canonicalize the root first: on some platforms (e.g. macOS /var -> /private/var)
  // the root itself is a symlink, so the symlink re-check below must compare against
  // the root's realpath, not its lexical path.
  const normalizedRoot = (await realpathIfExists(path.resolve(root))) ?? path.resolve(root);
  const raw = (relPath ?? "").trim();

  if (path.isAbsolute(raw)) {
    throw new EditorError("EDITOR_PATH_FORBIDDEN", "Absolute paths are not allowed.", { relPath });
  }

  const segments = raw.split(/[\\/]/);
  if (segments.some((segment) => segment === "..")) {
    throw new EditorError("EDITOR_PATH_FORBIDDEN", "Path traversal is not allowed.", { relPath });
  }

  if (options.forWrite && hasGitSegment(raw)) {
    throw new EditorError("EDITOR_PATH_FORBIDDEN", "Writing inside .git is not allowed.", { relPath });
  }

  const resolved = path.resolve(normalizedRoot, raw);
  assertInsideRoot(normalizedRoot, resolved);

  // Symlink defense (§5.2, §5.4): if the target exists, its realpath must be inside
  // the root — this rejects an EXISTING file that is a symlink pointing outside, for
  // BOTH reads and writes (a write would otherwise follow the link and clobber a file
  // outside the project). For a not-yet-existing write target, fall back to proving
  // the parent dir resolves inside the root.
  const realTarget = await realpathIfExists(resolved);
  if (realTarget !== null) {
    assertInsideRoot(normalizedRoot, realTarget);
    // Never write THROUGH a final-component symlink, even one resolving inside root:
    // we write to `resolved` directly, so a symlink there could redirect the write
    // (incl. a swap between this check and the write). Refuse it outright.
    if (options.forWrite) {
      const linkStat = await lstatIfExists(resolved);
      if (linkStat?.isSymbolicLink()) {
        throw new EditorError("EDITOR_PATH_FORBIDDEN", "Refusing to write through a symlink.", { relPath });
      }
    }
  } else if (options.forWrite) {
    const realParent = await realpathIfExists(path.dirname(resolved));
    if (realParent !== null) {
      assertInsideRoot(normalizedRoot, realParent);
    }
  }

  const rel = path.relative(normalizedRoot, resolved);
  return { absPath: resolved, relPath: rel.split(path.sep).join("/") };
}
