import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  GITIGNORE_BLOCK_END,
  GITIGNORE_BLOCK_START,
  INJECTED_RELATIVE_PATHS,
  SHARED_AGENTS_DIR,
  SHARED_CLAUDE_MD,
  SHARED_SKILLS_DIR,
} from "../config/constants";
import { childLogger } from "../lib/logger";
import { ProjectError } from "../controllers/projects/feature-utils/ProjectError";

const log = childLogger({ module: "ConfigInjectionService" });
const execFileAsync = promisify(execFile);

interface InjectionTarget {
  /** Absolute path of the link to create inside the project. */
  linkPath: string;
  /** Absolute path of the shared config the link points at. */
  target: string;
}

/**
 * Injects the shared, version-controlled config (CLAUDE.md + .claude/skills +
 * .claude/agents) into a selected project, because Claude's config walk stops at
 * the project's own repo root and will not reach the DevEasy root. The links are
 * gitignored in the project so they never enter its history.
 *
 * Linking is platform-aware: POSIX uses symlinks throughout; native Windows uses
 * directory junctions for the two folders and a hardlink for CLAUDE.md, so no
 * admin rights or Developer Mode are needed. A hardlink reflects in-place edits to
 * the shared CLAUDE.md (AgentConfigService writes in place), preserving live
 * propagation. On a cross-volume PROJECTS_ROOT the hardlink degrades to a copy
 * (logged), which does not live-update until the project is re-opened.
 *
 * Pre-existing real config is never overwritten — the service aborts with a
 * typed conflict instead (Spec 1 Risk; Constitution §5.2 path guarding applies
 * upstream in PathGuard).
 */
export class ConfigInjectionService {
  static async inject(projectPath: string): Promise<void> {
    await ConfigInjectionService.ensureSharedConfigExists();
    await ConfigInjectionService.ensureGitBoundary(projectPath);

    const targets: InjectionTarget[] = [
      { linkPath: path.join(projectPath, "CLAUDE.md"), target: SHARED_CLAUDE_MD },
      { linkPath: path.join(projectPath, ".claude", "skills"), target: SHARED_SKILLS_DIR },
      { linkPath: path.join(projectPath, ".claude", "agents"), target: SHARED_AGENTS_DIR },
    ];

    // .claude/ must exist as a real directory to hold the skills/agents links.
    await fs.mkdir(path.join(projectPath, ".claude"), { recursive: true });

    for (const t of targets) {
      await ConfigInjectionService.ensureLink(t.linkPath, t.target);
    }

    await ConfigInjectionService.ensureGitignoreBlock(projectPath);
    log.info({ projectPath }, "Injected shared config into project");
  }

  /**
   * Make the project its own git boundary. Claude Code resolves the project root
   * by walking up to the nearest `.git`; if the project folder isn't a repo (e.g. a
   * folder holding separate backend/frontend repos), Claude would walk past it into
   * the DevEasy repo and describe DevEasy instead of the project. A `git init` here
   * stops that walk at the project. Idempotent and best-effort — a failure is logged,
   * not fatal, so a session can still start.
   */
  private static async ensureGitBoundary(projectPath: string): Promise<void> {
    try {
      await fs.access(path.join(projectPath, ".git"));
      return; // already a repo (or has a .git file) — nothing to do
    } catch {
      // no .git here
    }
    try {
      await execFileAsync("git", ["init"], { cwd: projectPath });
      log.info({ projectPath }, "git init: made project its own root so Claude stays scoped to it");
    } catch (err) {
      log.warn({ projectPath, err }, "Could not git init project root; sessions may read the parent repo");
    }
  }

  private static async ensureSharedConfigExists(): Promise<void> {
    await fs.mkdir(SHARED_SKILLS_DIR, { recursive: true });
    await fs.mkdir(SHARED_AGENTS_DIR, { recursive: true });
    try {
      await fs.access(SHARED_CLAUDE_MD);
    } catch {
      await fs.writeFile(
        SHARED_CLAUDE_MD,
        "# Shared Agent Instructions\n\nManaged by DevEasy. Edit via the Agent Manager.\n",
      );
    }
  }

  /**
   * Link `target` into `linkPath`, idempotently. Dispatches by platform and by
   * whether the target is a directory: POSIX → symlink; Windows dir → junction;
   * Windows file → hardlink (with a cross-volume copy fallback).
   */
  private static async ensureLink(linkPath: string, target: string): Promise<void> {
    if (process.platform !== "win32") {
      return ConfigInjectionService.ensurePosixSymlink(linkPath, target);
    }
    const targetStat = await fs.stat(target); // shared config exists by now (ensureSharedConfigExists)
    return targetStat.isDirectory()
      ? ConfigInjectionService.ensureWindowsJunction(linkPath, target)
      : ConfigInjectionService.ensureWindowsHardlink(linkPath, target);
  }

  /** POSIX: create the symlink, or verify an existing one already points at our target. */
  private static async ensurePosixSymlink(linkPath: string, target: string): Promise<void> {
    const stat = await ConfigInjectionService.lstatOrNull(linkPath);
    if (stat) {
      if (stat.isSymbolicLink()) {
        const current = await fs.readlink(linkPath);
        const resolved = path.resolve(path.dirname(linkPath), current);
        if (resolved === path.resolve(target)) return; // idempotent: already ours
        await fs.unlink(linkPath); // replace a stale link we previously made
      } else {
        throw ConfigInjectionService.conflict(linkPath);
      }
    }
    await fs.symlink(target, linkPath);
  }

  /**
   * Windows directory link via junction (no privilege required). Node reports a
   * junction through readlink, so a re-inject that already points at our target is
   * idempotent; a stale junction is replaced; a real folder the project owns is a
   * conflict.
   */
  private static async ensureWindowsJunction(linkPath: string, target: string): Promise<void> {
    const existing = await ConfigInjectionService.readlinkOrNull(linkPath);
    if (existing !== null) {
      if (ConfigInjectionService.samePath(existing, target)) return; // already ours
      // Remove the stale link entry only (rmdir on a junction never touches its target).
      await fs.rmdir(linkPath).catch(() => fs.unlink(linkPath));
    } else if (await ConfigInjectionService.lstatOrNull(linkPath)) {
      throw ConfigInjectionService.conflict(linkPath); // a real file/dir the project owns
    }
    await fs.symlink(target, linkPath, "junction");
  }

  /**
   * Windows file link via hardlink (no privilege required); the hardlink shares the
   * shared CLAUDE.md's inode, so in-place edits propagate. An existing entry is ours
   * iff it is the same inode (same volume) or — in the cross-volume copy case — has
   * identical content; otherwise it is the project's own file and a conflict.
   */
  private static async ensureWindowsHardlink(linkPath: string, target: string): Promise<void> {
    const stat = await ConfigInjectionService.lstatOrNull(linkPath);
    if (stat) {
      if (stat.isSymbolicLink()) {
        await fs.unlink(linkPath); // stale symlink left by a previous (POSIX) inject
      } else if (stat.isFile()) {
        if (await ConfigInjectionService.isSameFile(linkPath, target)) return; // ours — idempotent
        throw ConfigInjectionService.conflict(linkPath);
      } else {
        throw ConfigInjectionService.conflict(linkPath);
      }
    }
    try {
      await fs.link(target, linkPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EXDEV") {
        // PROJECTS_ROOT is on a different volume than the repo — hardlinks can't span
        // volumes. Copy instead; edits won't propagate until the project is re-opened.
        await fs.copyFile(target, linkPath);
        log.warn(
          { linkPath, target },
          "Shared CLAUDE.md is on a different volume; copied instead of hardlinked — edits will not propagate until the project is re-opened",
        );
        return;
      }
      throw err;
    }
  }

  /** True if the link and target are the same inode (hardlink) or identical copies. */
  private static async isSameFile(linkPath: string, target: string): Promise<boolean> {
    const [a, b] = await Promise.all([fs.stat(linkPath), fs.stat(target)]);
    if (a.ino !== 0 && a.ino === b.ino && a.dev === b.dev) return true; // same inode = our hardlink
    // Cross-volume copy fallback: matching content means it is our copy (safe to keep).
    const [ca, cb] = await Promise.all([fs.readFile(linkPath), fs.readFile(target)]);
    return ca.equals(cb);
  }

  private static async lstatOrNull(p: string): Promise<import("node:fs").Stats | null> {
    try {
      return await fs.lstat(p);
    } catch {
      return null;
    }
  }

  private static async readlinkOrNull(p: string): Promise<string | null> {
    try {
      return await fs.readlink(p);
    } catch {
      return null; // not a link (EINVAL) or missing (ENOENT)
    }
  }

  /** Case-insensitive, prefix-tolerant path equality (Windows junction targets). */
  private static samePath(a: string, b: string): boolean {
    const norm = (p: string) => path.resolve(p.replace(/^\\\\\?\\/, "")).toLowerCase();
    return norm(a) === norm(b);
  }

  /** A real file/dir the project owns must never be clobbered (§5.2). */
  private static conflict(linkPath: string): ProjectError {
    return new ProjectError(
      "CONFIG_INJECTION_CONFLICT",
      `Project already has its own ${path.basename(linkPath)}. Resolve it before opening here.`,
      { linkPath },
    );
  }

  /** Append (once) a managed sentinel block to the project's .gitignore. */
  private static async ensureGitignoreBlock(projectPath: string): Promise<void> {
    const gitignorePath = path.join(projectPath, ".gitignore");
    let content = "";
    try {
      content = await fs.readFile(gitignorePath, "utf8");
    } catch {
      content = "";
    }

    if (content.includes(GITIGNORE_BLOCK_START)) return;

    const block = [
      GITIGNORE_BLOCK_START,
      ...INJECTED_RELATIVE_PATHS,
      GITIGNORE_BLOCK_END,
      "",
    ].join("\n");

    const prefix = content.length && !content.endsWith("\n") ? "\n" : "";
    await fs.writeFile(gitignorePath, `${content}${prefix}${block}`);
  }
}
