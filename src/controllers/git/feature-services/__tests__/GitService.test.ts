import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectModel } from "../../../../models/ProjectModel";
import type { IProject } from "../../../../models/ProjectModel";
import { GitError } from "../../feature-utils/GitError";
import { GitService } from "../GitService";

const execFileAsync = promisify(execFile);
const PROJECT_ID = 1;

let workDir: string;
let bareDir: string;

/** Point ProjectModel.findById at our temp repo so no DB is touched. */
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

const git = (cwd: string, args: string[]) => execFileAsync("git", args, { cwd });

/** A fresh repo on `main` with a bare `origin` and one pushed commit. */
async function setupRepo(): Promise<void> {
  bareDir = await fs.mkdtemp(path.join(os.tmpdir(), "git-bare-"));
  await git(bareDir, ["init", "--bare", "-b", "main", "."]);

  workDir = await fs.mkdtemp(path.join(os.tmpdir(), "git-work-"));
  await git(workDir, ["init", "-b", "main", "."]);
  await git(workDir, ["config", "user.email", "test@example.com"]);
  await git(workDir, ["config", "user.name", "Test User"]);
  await git(workDir, ["remote", "add", "origin", bareDir]);
  await fs.writeFile(path.join(workDir, "base.txt"), "base\n", "utf8");
  await git(workDir, ["add", "base.txt"]);
  await git(workDir, ["commit", "-m", "initial"]);
  await git(workDir, ["push", "-u", "origin", "main"]);
  stubProject(workDir);
}

beforeEach(setupRepo);

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(workDir, { recursive: true, force: true });
  await fs.rm(bareDir, { recursive: true, force: true });
});

describe("GitService.stage / commit", () => {
  it("stages a new file and commits it", async () => {
    await fs.writeFile(path.join(workDir, "new.txt"), "hello\n", "utf8");
    const staged = await GitService.stage(PROJECT_ID, ["new.txt"]);
    expect(staged.files.some((f) => f.path === "new.txt")).toBe(true);

    const after = await GitService.commit(PROJECT_ID, "add new.txt");
    expect(after.isClean).toBe(true);
    const log = await git(workDir, ["log", "--oneline"]);
    expect(log.stdout).toContain("add new.txt");
  });

  it("rejects committing with nothing staged", async () => {
    await expect(GitService.commit(PROJECT_ID, "noop")).rejects.toMatchObject({
      code: "GIT_NOTHING_TO_COMMIT",
    });
  });

  it("rejects an empty commit message", async () => {
    await fs.writeFile(path.join(workDir, "x.txt"), "x\n", "utf8");
    await GitService.stage(PROJECT_ID, ["x.txt"]);
    await expect(GitService.commit(PROJECT_ID, "   ")).rejects.toMatchObject({
      code: "GIT_COMMIT_EMPTY_MESSAGE",
    });
  });

  it("ignores parent-escaping paths (nothing valid to stage)", async () => {
    await expect(GitService.stage(PROJECT_ID, ["../escape.txt"])).rejects.toMatchObject({
      code: "GIT_NO_PATHS",
    });
  });
});

describe("GitService.createBranch", () => {
  it("creates and switches to a valid branch", async () => {
    const status = await GitService.createBranch(PROJECT_ID, "feature/foo");
    expect(status.branch).toBe("feature/foo");
  });

  it("rejects an invalid branch name", async () => {
    await expect(GitService.createBranch(PROJECT_ID, "bad name;rm -rf")).rejects.toMatchObject({
      code: "GIT_BRANCH_INVALID",
    });
  });

  it("rejects a duplicate branch name", async () => {
    await GitService.createBranch(PROJECT_ID, "dup");
    await git(workDir, ["checkout", "main"]);
    await expect(GitService.createBranch(PROJECT_ID, "dup")).rejects.toMatchObject({
      code: "GIT_BRANCH_EXISTS",
    });
  });
});

describe("GitService.push", () => {
  it("pushes a new branch by setting upstream", async () => {
    await GitService.createBranch(PROJECT_ID, "feature/push");
    await fs.writeFile(path.join(workDir, "p.txt"), "p\n", "utf8");
    await GitService.stage(PROJECT_ID, ["p.txt"]);
    await GitService.commit(PROJECT_ID, "add p");
    const status = await GitService.push(PROJECT_ID);
    expect(status.branch).toBe("feature/push");
    const remoteBranches = await git(bareDir, ["branch", "--list"]);
    expect(remoteBranches.stdout).toContain("feature/push");
  });
});

describe("GitService.mergeToMain", () => {
  it("merges a clean branch into main and pushes", async () => {
    await GitService.createBranch(PROJECT_ID, "feature/clean");
    await fs.writeFile(path.join(workDir, "feature.txt"), "feature\n", "utf8");
    await GitService.stage(PROJECT_ID, ["feature.txt"]);
    await GitService.commit(PROJECT_ID, "add feature");

    const status = await GitService.mergeToMain(PROJECT_ID);
    expect(status.branch).toBe("main");
    const onMain = await fs.readFile(path.join(workDir, "feature.txt"), "utf8");
    expect(onMain).toBe("feature\n");
  });

  it("aborts and stays clean on a merge conflict", async () => {
    // Diverge: main edits base.txt, then a branch edits the same line.
    await GitService.createBranch(PROJECT_ID, "feature/conflict");
    await fs.writeFile(path.join(workDir, "base.txt"), "branch change\n", "utf8");
    await GitService.stage(PROJECT_ID, ["base.txt"]);
    await GitService.commit(PROJECT_ID, "branch edit");

    await git(workDir, ["checkout", "main"]);
    await fs.writeFile(path.join(workDir, "base.txt"), "main change\n", "utf8");
    await git(workDir, ["commit", "-am", "main edit"]);
    await git(workDir, ["checkout", "feature/conflict"]);

    await expect(GitService.mergeToMain(PROJECT_ID)).rejects.toBeInstanceOf(GitError);

    // Tree is clean and we are back on the source branch — not half-merged.
    const status = await GitService.getStatus(PROJECT_ID);
    expect(status.isClean).toBe(true);
    expect(status.branch).toBe("feature/conflict");
  });

  it("refuses to merge when already on main", async () => {
    await expect(GitService.mergeToMain(PROJECT_ID)).rejects.toMatchObject({
      code: "GIT_ALREADY_ON_MAIN",
    });
  });
});
