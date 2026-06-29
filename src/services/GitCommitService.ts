import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { REPO_ROOT } from "../config/constants";
import { childLogger } from "../lib/logger";
import { AgentConfigError } from "../controllers/agent-config/feature-utils/AgentConfigError";

const execFileAsync = promisify(execFile);
const log = childLogger({ module: "GitCommitService" });

/** Commit author forced to the Project Profile identity — never amend, never push. */
const COMMIT_AUTHOR_NAME = "LagDave";
const COMMIT_AUTHOR_EMAIL = "laggy80@gmail.com";

/**
 * Stages a single config file and commits it to the DevEasy repo with the
 * profile author. Local commit only: no push, no amend, no force (Spec 4 v1 git
 * decision). One commit per save, scoped to the changed path, message naming it.
 */
export class GitCommitService {
  /**
   * Stage `absoluteFilePath` and commit it. The path must live inside REPO_ROOT
   * (it always does — it comes from AgentConfigService's guarded resolver).
   */
  static async commitFile(absoluteFilePath: string, action: string): Promise<void> {
    const relative = path.relative(REPO_ROOT, absoluteFilePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AgentConfigError(
        "AGENT_CONFIG_PATH_OUTSIDE_ROOT",
        "Refusing to commit a path outside the repo.",
        { absoluteFilePath },
      );
    }

    try {
      // Stage exactly this path (works for a file or a removed skill dir).
      await execFileAsync("git", ["add", "--", relative], { cwd: REPO_ROOT });
    } catch (error) {
      throw new AgentConfigError("AGENT_CONFIG_GIT_FAILED", "Failed to stage config change.", {
        relative,
        cause: (error as Error).message,
      });
    }

    const message = `chore: ${action} ${relative} via Agent Manager`;
    try {
      await execFileAsync(
        "git",
        [
          "-c",
          `user.name=${COMMIT_AUTHOR_NAME}`,
          "-c",
          `user.email=${COMMIT_AUTHOR_EMAIL}`,
          "commit",
          "-m",
          message,
          "--",
          relative,
        ],
        { cwd: REPO_ROOT },
      );
      log.info({ relative, action }, "Committed config change");
    } catch (error) {
      // `git commit` exits non-zero when there is nothing staged to commit (an
      // idempotent re-save). Treat that as a no-op rather than a failure.
      const stderr = (error as { stderr?: string }).stderr ?? "";
      const stdout = (error as { stdout?: string }).stdout ?? "";
      if (/nothing to commit|no changes added/i.test(stderr + stdout)) {
        log.info({ relative }, "No changes to commit; skipping");
        return;
      }
      throw new AgentConfigError("AGENT_CONFIG_GIT_FAILED", "Failed to commit config change.", {
        relative,
        cause: (error as Error).message,
      });
    }
  }
}
