import fs from "node:fs/promises";
import path from "node:path";
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

interface InjectionTarget {
  /** Absolute path of the link to create inside the project. */
  linkPath: string;
  /** Absolute path of the shared config the link points at. */
  target: string;
}

/**
 * Injects the shared, version-controlled config (CLAUDE.md + .claude/skills +
 * .claude/agents) into a selected project via symlink, because Claude's config
 * walk stops at the project's own repo root and will not reach the DevEasy root.
 * Symlinks are gitignored in the project so they never enter its history.
 *
 * Pre-existing real config is never overwritten — the service aborts with a
 * typed conflict instead (Spec 1 Risk; Constitution §5.2 path guarding applies
 * upstream in PathGuard).
 */
export class ConfigInjectionService {
  static async inject(projectPath: string): Promise<void> {
    await ConfigInjectionService.ensureSharedConfigExists();

    const targets: InjectionTarget[] = [
      { linkPath: path.join(projectPath, "CLAUDE.md"), target: SHARED_CLAUDE_MD },
      { linkPath: path.join(projectPath, ".claude", "skills"), target: SHARED_SKILLS_DIR },
      { linkPath: path.join(projectPath, ".claude", "agents"), target: SHARED_AGENTS_DIR },
    ];

    // .claude/ must exist as a real directory to hold the skills/agents links.
    await fs.mkdir(path.join(projectPath, ".claude"), { recursive: true });

    for (const t of targets) {
      await ConfigInjectionService.ensureSymlink(t.linkPath, t.target);
    }

    await ConfigInjectionService.ensureGitignoreBlock(projectPath);
    log.info({ projectPath }, "Injected shared config into project");
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

  /** Create the symlink, or verify an existing one already points at our target. */
  private static async ensureSymlink(linkPath: string, target: string): Promise<void> {
    let stat: import("node:fs").Stats | null = null;
    try {
      stat = await fs.lstat(linkPath);
    } catch {
      stat = null;
    }

    if (stat) {
      if (stat.isSymbolicLink()) {
        const current = await fs.readlink(linkPath);
        const resolved = path.resolve(path.dirname(linkPath), current);
        if (resolved === path.resolve(target)) return; // idempotent: already ours
        await fs.unlink(linkPath); // replace a stale link we previously made
      } else {
        // A real file/dir the project owns — never clobber it.
        throw new ProjectError(
          "CONFIG_INJECTION_CONFLICT",
          `Project already has its own ${path.basename(linkPath)}. Resolve it before opening here.`,
          { linkPath },
        );
      }
    }

    await fs.symlink(target, linkPath);
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
