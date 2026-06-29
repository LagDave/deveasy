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
 * Reads local git state for the active project. Git is invoked via execFile with an
 * argv array and a fixed cwd — never a shell string with interpolated input
 * (Constitution §5.2 command-injection). DB access goes through the model (§7.4).
 */
export class GitService {
  /** Resolve the active project's on-disk path, or throw a typed error. */
  private static async resolveActiveProjectPath(): Promise<string> {
    const id = await ProjectModel.getActiveProjectId();
    if (!id) {
      throw new GitError("GIT_NO_ACTIVE_PROJECT", "No active project is selected.");
    }
    const project = await ProjectModel.findById(id);
    if (!project) {
      throw new GitError("GIT_PROJECT_NOT_FOUND", "Active project not found.", { projectId: id });
    }
    await GitService.assertGitRepo(project.path);
    return project.path;
  }

  private static async assertGitRepo(dir: string): Promise<void> {
    try {
      const stat = await fs.stat(path.join(dir, ".git"));
      if (!stat.isDirectory() && !stat.isFile()) {
        throw new GitError("GIT_NOT_A_REPO", "The active project is not a git repository.", { dir });
      }
    } catch (err) {
      if (err instanceof GitError) throw err;
      throw new GitError("GIT_NOT_A_REPO", "The active project is not a git repository.", { dir });
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

  /** Commit history + current branch for the active project. */
  static async getHistory(limit = DEFAULT_HISTORY_LIMIT): Promise<GitHistory> {
    const cwd = await GitService.resolveActiveProjectPath();
    const branch = await GitService.getCurrentBranch(cwd);
    const format = ["%H", "%an", "%aI", "%s"].join(LOG_FIELD_SEP) + LOG_RECORD_SEP;
    const out = await GitService.runGit(cwd, [
      "log",
      `-${Math.max(1, Math.min(limit, 500))}`,
      `--pretty=format:${format}`,
    ]);
    const commits = GitService.parseLog(out);
    return { branch, commits };
  }

  /** Working-tree status for the active project. */
  static async getStatus(): Promise<GitStatus> {
    const cwd = await GitService.resolveActiveProjectPath();
    const out = await GitService.runGit(cwd, ["status", "--porcelain=v1", "--branch"]);
    return GitService.parseStatus(out);
  }

  private static async getCurrentBranch(cwd: string): Promise<string> {
    const out = await GitService.runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    return out.trim() || "HEAD";
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
        branch = header.split("...")[0].split(" ")[0] || "HEAD";
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
