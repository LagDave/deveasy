import fs from "node:fs/promises";
import path from "node:path";
import { childLogger } from "../../../lib/logger";
import { ProjectModel } from "../../../models/ProjectModel";
import { EditorError } from "../feature-utils/EditorError";
import {
  classifyFile,
  contentTypeFor,
  type FileKind,
  IGNORED_DIR_NAMES,
  MAX_RAW_BYTES,
  MAX_TEXT_BYTES,
  resolveSafePath,
} from "../feature-utils/fileSafety";

const log = childLogger({ module: "EditorService" });

export interface TreeEntry {
  name: string;
  /** Relative, posix-style path from the project root. */
  path: string;
  type: "file" | "dir";
}

export interface FileContent {
  path: string;
  content: string;
  kind: FileKind;
}

export interface SaveResult {
  path: string;
  savedAt: string;
}

export interface RawStat {
  absPath: string;
  contentType: string;
  size: number;
}

/**
 * Business logic for the in-app code editor. The project root is resolved ONLY via
 * ProjectModel.findById — never trusted from the client (Constitution §5.4, §7.4) —
 * and EVERY path is routed through fileSafety.resolveSafePath before any fs call
 * (§5.2). Thin controller calls these; no req/res here.
 */
export class EditorService {
  /** Resolve a project's trusted on-disk root by id, or throw a typed error. */
  private static async resolveProjectRoot(projectId: number): Promise<string> {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new EditorError("EDITOR_NO_ACTIVE_PROJECT", "A valid projectId is required.");
    }
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new EditorError("EDITOR_PROJECT_NOT_FOUND", "Project not found.", { projectId });
    }
    return project.path;
  }

  /** One directory level: entries sorted dirs-first then by name, ignore-list applied. */
  static async listDir(projectId: number, relPath: string): Promise<TreeEntry[]> {
    const root = await EditorService.resolveProjectRoot(projectId);
    const target = relPath === "" || relPath === "." ? "" : relPath;
    const { absPath, relPath: safeRel } = await resolveSafePath(root, target);

    let dirents;
    try {
      dirents = await fs.readdir(absPath, { withFileTypes: true });
    } catch (err) {
      throw new EditorError("EDITOR_NOT_A_FILE", "Directory could not be read.", { relPath, cause: String(err) });
    }

    const entries: TreeEntry[] = dirents
      .filter((d) => !(d.isDirectory() && IGNORED_DIR_NAMES.includes(d.name)))
      .map((d) => {
        const childRel = safeRel === "" ? d.name : `${safeRel}/${d.name}`;
        return { name: d.name, path: childRel, type: d.isDirectory() ? "dir" : "file" } as const;
      });

    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return entries;
  }

  /** Read a text file as UTF-8; rejects oversized and non-text (binary uses raw). */
  static async readFile(projectId: number, relPath: string): Promise<FileContent> {
    const root = await EditorService.resolveProjectRoot(projectId);
    const { absPath, relPath: safeRel } = await resolveSafePath(root, relPath);

    const stat = await EditorService.statFile(absPath, relPath);
    if (!stat.isFile()) {
      throw new EditorError("EDITOR_NOT_A_FILE", "Path is not a file.", { relPath: safeRel });
    }
    if (stat.size > MAX_TEXT_BYTES) {
      throw new EditorError("EDITOR_FILE_TOO_LARGE", "File is too large to open as text.", {
        relPath: safeRel,
        size: stat.size,
        max: MAX_TEXT_BYTES,
      });
    }
    const kind = classifyFile(path.basename(absPath));
    if (kind !== "text" && kind !== "html") {
      throw new EditorError("EDITOR_UNSUPPORTED", "Binary files cannot be opened as text.", {
        relPath: safeRel,
        kind,
      });
    }

    const content = await fs.readFile(absPath, "utf8");
    return { path: safeRel, content, kind };
  }

  /** Write UTF-8 text to a file; rejects oversized content and non-text targets. */
  static async writeFile(projectId: number, relPath: string, content: string): Promise<SaveResult> {
    const root = await EditorService.resolveProjectRoot(projectId);
    const { absPath, relPath: safeRel } = await resolveSafePath(root, relPath, { forWrite: true });

    const byteLength = Buffer.byteLength(content, "utf8");
    if (byteLength > MAX_TEXT_BYTES) {
      throw new EditorError("EDITOR_FILE_TOO_LARGE", "Content exceeds the maximum text size.", {
        relPath: safeRel,
        size: byteLength,
        max: MAX_TEXT_BYTES,
      });
    }
    const kind = classifyFile(path.basename(absPath));
    if (kind === "image" || kind === "pdf") {
      throw new EditorError("EDITOR_UNSUPPORTED", "Only text files can be written.", { relPath: safeRel, kind });
    }

    try {
      await fs.writeFile(absPath, content, "utf8");
    } catch (err) {
      log.error({ relPath: safeRel, err }, "editor write failed");
      throw new EditorError("EDITOR_WRITE_FAILED", "Failed to write the file.", { relPath: safeRel });
    }
    return { path: safeRel, savedAt: new Date().toISOString() };
  }

  /** Resolve + size-check a file for raw streaming (images, PDFs, HTML-as-page). */
  static async statForRaw(projectId: number, relPath: string): Promise<RawStat> {
    const root = await EditorService.resolveProjectRoot(projectId);
    const { absPath, relPath: safeRel } = await resolveSafePath(root, relPath);

    const stat = await EditorService.statFile(absPath, relPath);
    if (!stat.isFile()) {
      throw new EditorError("EDITOR_NOT_A_FILE", "Path is not a file.", { relPath: safeRel });
    }
    if (stat.size > MAX_RAW_BYTES) {
      throw new EditorError("EDITOR_FILE_TOO_LARGE", "File is too large to stream.", {
        relPath: safeRel,
        size: stat.size,
        max: MAX_RAW_BYTES,
      });
    }
    return { absPath, contentType: contentTypeFor(path.basename(absPath)), size: stat.size };
  }

  /** stat() wrapper that maps a missing file to a typed not-found error. */
  private static async statFile(absPath: string, relPath: string): Promise<import("node:fs").Stats> {
    try {
      return await fs.stat(absPath);
    } catch {
      throw new EditorError("EDITOR_FILE_NOT_FOUND", "File not found.", { relPath });
    }
  }
}
