import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { childLogger } from "../../../lib/logger";
import { ProjectModel } from "../../../models/ProjectModel";
import { GitError } from "../feature-utils/GitError";

const execFileAsync = promisify(execFile);
const log = childLogger({ module: "GitService" });

/** Default number of commits returned by history. */
const DEFAULT_HISTORY_LIMIT = 50;
/** The integration branch that "merge to main" targets. */
const MAIN_BRANCH = "main";
/** Allow-list for branch names passed to git — blocks option/argv injection (§5.2). */
const BRANCH_NAME_RE = /^[A-Za-z0-9._/-]+$/;
/** Field separator for the parseable git log format (unlikely in commit metadata). */
const LOG_FIELD_SEP = "";
/** Record separator for git log entries. */
const LOG_RECORD_SEP = "";

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  subject: string;
}

export interface GitStatusFile {
  path: string;
  state: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  files: GitStatusFile[];
  isClean: boolean;
}

export interface GitHistory {
  branch: string;
  commits: GitCommit[];
}

/**
 * Reads local git state for an explicitly-chosen project. Git is invoked via execFile
 * with an argv array and a fixed cwd — never a shell string with interpolated input
 * (Constitution §5.2 command-injection). DB access goes through the model (§7.4).
 */
export class GitService {
  /** Resolve a project's on-disk path by id, or throw a typed error. */
  private static async resolveProjectPath(projectId: number): Promise<string> {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new GitError("GIT_NO_ACTIVE_PROJECT", "A valid projectId is required.");
    }
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new GitError("GIT_PROJECT_NOT_FOUND", "Project not found.", { projectId });
    }
    await GitService.assertGitRepo(project.path);
    return project.path;
  }

  private static async assertGitRepo(dir: string): Promise<void> {
    try {
      const stat = await fs.stat(path.join(dir, ".git"));
      if (!stat.isDirectory() && !stat.isFile()) {
        throw new GitError("GIT_NOT_A_REPO", "The selected project is not a git repository.", { dir });
      }
    } catch (err) {
      if (err instanceof GitError) throw err;
      throw new GitError("GIT_NOT_A_REPO", "The selected project is not a git repository.", { dir });
    }
  }

  /** Run git with a fixed cwd and an argv array — no shell interpolation (§5.2). */
  private static async runGit(cwd: string, args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 });
      return stdout;
    } catch (err) {
      log.error({ cwd, args, err }, "git command failed");
      throw new GitError("GIT_COMMAND_FAILED", "A git command failed.", { args });
    }
  }

  /** Commit history + current branch for the given project. */
  static async getHistory(projectId: number, limit = DEFAULT_HISTORY_LIMIT): Promise<GitHistory> {
    const cwd = await GitService.resolveProjectPath(projectId);
    const branch = await GitService.getCurrentBranch(cwd);
    const format = ["%H", "%an", "%aI", "%s"].join(LOG_FIELD_SEP) + LOG_RECORD_SEP;
    let commits: GitCommit[] = [];
    try {
      const out = await GitService.runGit(cwd, [
        "log",
        `-${Math.max(1, Math.min(limit, 500))}`,
        `--pretty=format:${format}`,
      ]);
      commits = GitService.parseLog(out);
    } catch {
      // An unborn branch (no commits yet) makes `git log` exit non-zero — that's an
      // empty history, not an error. Show the branch with no commits.
      commits = [];
    }
    return { branch, commits };
  }

  /** Working-tree status for the given project. */
  static async getStatus(projectId: number): Promise<GitStatus> {
    const cwd = await GitService.resolveProjectPath(projectId);
    const out = await GitService.runGit(cwd, ["status", "--porcelain=v1", "--branch"]);
    return GitService.parseStatus(out);
  }

  /** Local branches (recent first) + the current branch, for the picker. */
  static async getBranches(projectId: number): Promise<{ current: string; branches: string[] }> {
    const cwd = await GitService.resolveProjectPath(projectId);
    const current = await GitService.getCurrentBranch(cwd);
    const out = await GitService.runGit(cwd, [
      "branch",
      "--format=%(refname:short)",
      "--sort=-committerdate",
    ]);
    const branches = out.split("\n").map((s) => s.trim()).filter(Boolean);
    return { current, branches };
  }

  /** Switch branches. The target is validated against the real branch list so an
   *  attacker can't smuggle extra argv into checkout (§5.2). */
  static async checkout(projectId: number, branch: string): Promise<GitStatus> {
    const { branches } = await GitService.getBranches(projectId);
    if (!branches.includes(branch)) {
      throw new GitError("GIT_BRANCH_NOT_FOUND", "Unknown branch.", { branch });
    }
    const cwd = await GitService.resolveProjectPath(projectId);
    await GitService.runGit(cwd, ["checkout", branch]);
    return GitService.getStatus(projectId);
  }

  /** Stage paths (git add). Paths are validated and passed after `--` so they can
   *  never be read as git options (§5.2). Returns fresh status. */
  static async stage(projectId: number, paths: string[]): Promise<GitStatus> {
    const cwd = await GitService.resolveProjectPath(projectId);
    const safe = GitService.validatePaths(paths);
    if (safe.length === 0) throw new GitError("GIT_NO_PATHS", "No valid paths to stage.");
    await GitService.runGit(cwd, ["add", "--", ...safe]);
    return GitService.getStatus(projectId);
  }

  /** Unstage paths (git restore --staged). Returns fresh status. */
  static async unstage(projectId: number, paths: string[]): Promise<GitStatus> {
    const cwd = await GitService.resolveProjectPath(projectId);
    const safe = GitService.validatePaths(paths);
    if (safe.length === 0) throw new GitError("GIT_NO_PATHS", "No valid paths to unstage.");
    await GitService.runGit(cwd, ["restore", "--staged", "--", ...safe]);
    return GitService.getStatus(projectId);
  }

  /** Commit currently-staged changes using the repo's own configured identity —
   *  we never force an author (§ spec decision). Returns fresh status. */
  static async commit(projectId: number, message: string): Promise<GitStatus> {
    const cwd = await GitService.resolveProjectPath(projectId);
    const msg = message.trim();
    if (!msg) throw new GitError("GIT_COMMIT_EMPTY_MESSAGE", "A commit message is required.");
    const result = await GitService.runGitRaw(cwd, ["commit", "-m", msg]);
    if (result.code !== 0) {
      const combined = `${result.stdout}\n${result.stderr}`;
      if (/nothing to commit|no changes added/i.test(combined)) {
        throw new GitError("GIT_NOTHING_TO_COMMIT", "Nothing staged to commit.");
      }
      if (/please tell me who you are|user\.email/i.test(combined)) {
        throw new GitError("GIT_NO_IDENTITY", "Set your git user.name and user.email before committing.");
      }
      log.error({ cwd, stderr: result.stderr }, "git commit failed");
      throw new GitError("GIT_COMMIT_FAILED", "Failed to create the commit.");
    }
    return GitService.getStatus(projectId);
  }

  /** Create and switch to a new branch. Name is allow-list validated (§5.2). */
  static async createBranch(projectId: number, name: string): Promise<GitStatus> {
    const branch = name.trim();
    if (!GitService.isValidBranchName(branch)) {
      throw new GitError("GIT_BRANCH_INVALID", "Invalid branch name.", { branch });
    }
    const cwd = await GitService.resolveProjectPath(projectId);
    const result = await GitService.runGitRaw(cwd, ["checkout", "-b", branch]);
    if (result.code !== 0) {
      if (/already exists/i.test(result.stderr)) {
        throw new GitError("GIT_BRANCH_EXISTS", "A branch with that name already exists.", { branch });
      }
      log.error({ cwd, branch, stderr: result.stderr }, "git branch create failed");
      throw new GitError("GIT_BRANCH_FAILED", "Failed to create the branch.");
    }
    return GitService.getStatus(projectId);
  }

  /** Push the current branch, setting upstream on the first push. Never force. */
  static async push(projectId: number): Promise<GitStatus> {
    const cwd = await GitService.resolveProjectPath(projectId);
    const branch = await GitService.getCurrentBranch(cwd);
    const args = (await GitService.hasUpstream(cwd))
      ? ["push"]
      : ["push", "--set-upstream", "origin", branch];
    const result = await GitService.runGitRaw(cwd, args);
    if (result.code !== 0) {
      log.error({ cwd, branch, stderr: result.stderr }, "git push failed");
      if (/no configured push destination|could not read from remote|does not appear to be a git repository/i.test(result.stderr)) {
        throw new GitError("GIT_NO_REMOTE", "No remote is configured to push to.");
      }
      throw new GitError("GIT_PUSH_FAILED", "Push failed. Check your remote and credentials.");
    }
    return GitService.getStatus(projectId);
  }

  /** Merge the current branch into main and push. Aborts cleanly on conflict so
   *  the working tree is never left half-merged (§ spec risk). Returns fresh status. */
  static async mergeToMain(projectId: number): Promise<GitStatus> {
    const cwd = await GitService.resolveProjectPath(projectId);
    const source = await GitService.getCurrentBranch(cwd);
    if (source === MAIN_BRANCH) {
      throw new GitError("GIT_ALREADY_ON_MAIN", "You are already on main; nothing to merge.");
    }
    const { branches } = await GitService.getBranches(projectId);
    if (!branches.includes(MAIN_BRANCH)) {
      throw new GitError("GIT_NO_MAIN", "This repository has no main branch.");
    }

    await GitService.runGit(cwd, ["checkout", MAIN_BRANCH]);
    const merge = await GitService.runGitRaw(cwd, ["merge", "--no-edit", source]);
    if (merge.code !== 0) {
      // Roll back rather than leaving a conflicted tree on main.
      await GitService.runGitRaw(cwd, ["merge", "--abort"]);
      await GitService.runGitRaw(cwd, ["checkout", source]);
      throw new GitError(
        "GIT_MERGE_CONFLICT",
        `Merging ${source} into ${MAIN_BRANCH} hit conflicts; the merge was aborted.`,
        { source },
      );
    }

    const pushArgs = (await GitService.hasUpstream(cwd))
      ? ["push"]
      : ["push", "--set-upstream", "origin", MAIN_BRANCH];
    const push = await GitService.runGitRaw(cwd, pushArgs);
    if (push.code !== 0) {
      log.error({ cwd, stderr: push.stderr }, "git push after merge failed");
      throw new GitError(
        "GIT_PUSH_FAILED",
        "Merged into main locally, but the push failed. Check your remote and credentials.",
      );
    }
    return GitService.getStatus(projectId);
  }

  /** Validate working-tree paths: reject absolute, parent-escaping, or option-like. */
  private static validatePaths(paths: unknown): string[] {
    if (!Array.isArray(paths)) return [];
    return (paths as unknown[])
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter(
        (p) =>
          p.length > 0 &&
          !p.startsWith("-") &&
          !path.isAbsolute(p) &&
          !p.split("/").includes(".."),
      );
  }

  private static isValidBranchName(name: string): boolean {
    return (
      BRANCH_NAME_RE.test(name) &&
      !name.startsWith("-") &&
      !name.includes("..") &&
      name.length <= 200
    );
  }

  /** True when the current branch has a configured upstream (so a plain push works). */
  private static async hasUpstream(cwd: string): Promise<boolean> {
    const res = await GitService.runGitRaw(cwd, [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{u}",
    ]);
    return res.code === 0;
  }

  /**
   * Like runGit but returns the result instead of throwing on a non-zero exit —
   * for commands whose non-zero exit is a meaningful state (merge conflict,
   * nothing to commit) rather than a hard failure.
   */
  private static async runGitRaw(
    cwd: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    try {
      const { stdout, stderr } = await execFileAsync("git", args, {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
      });
      return { stdout, stderr, code: 0 };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? "",
        code: typeof e.code === "number" ? e.code : 1,
      };
    }
  }

  private static async getCurrentBranch(cwd: string): Promise<string> {
    // symbolic-ref resolves the branch name even on an unborn branch (fresh
    // `git init`, no commits) where `rev-parse --abbrev-ref` prints "HEAD".
    try {
      const out = await GitService.runGit(cwd, ["symbolic-ref", "--short", "HEAD"]);
      const name = out.trim();
      if (name) return name;
    } catch {
      // Detached HEAD (no symbolic ref) — fall through to rev-parse.
    }
    try {
      const out = await GitService.runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
      return out.trim() || "HEAD";
    } catch {
      return "HEAD";
    }
  }

  private static parseLog(raw: string): GitCommit[] {
    return raw
      .split(LOG_RECORD_SEP)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => {
        const [hash, author, date, subject] = entry.split(LOG_FIELD_SEP);
        return {
          hash: hash ?? "",
          author: author ?? "",
          date: date ?? "",
          subject: subject ?? "",
        };
      });
  }

  private static parseStatus(raw: string): GitStatus {
    const lines = raw.split("\n").filter((l) => l.length > 0);
    let branch = "HEAD";
    let ahead = 0;
    let behind = 0;
    const files: GitStatusFile[] = [];

    for (const line of lines) {
      if (line.startsWith("##")) {
        const header = line.slice(2).trim();
        // Unborn branch (fresh repo, no commits): "No commits yet on main".
        if (header.startsWith("No commits yet on ")) {
          branch = header.slice("No commits yet on ".length).trim() || "HEAD";
        } else {
          branch = header.split("...")[0].split(" ")[0] || "HEAD";
        }
        const aheadMatch = header.match(/ahead (\d+)/);
        const behindMatch = header.match(/behind (\d+)/);
        if (aheadMatch) ahead = Number(aheadMatch[1]);
        if (behindMatch) behind = Number(behindMatch[1]);
        continue;
      }
      const state = line.slice(0, 2);
      const filePath = line.slice(3);
      files.push({ path: filePath, state });
    }

    return { branch, ahead, behind, files, isClean: files.length === 0 };
  }
}
