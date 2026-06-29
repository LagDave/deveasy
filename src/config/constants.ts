import path from "node:path";

/**
 * Named constants — no magic values scattered through the code (Constitution §4.2).
 */
export const DEFAULT_PORT = 1234;
export const DEFAULT_LOG_LEVEL = "info";

/** Default location of project clones, relative to the repo root. */
export const DEFAULT_PROJECTS_DIRNAME = "projects";

/** Repo root = two levels up from src/config. */
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** The shared config that gets injected into each selected project (Spec 1, §5.2). */
export const SHARED_CLAUDE_MD = path.join(REPO_ROOT, "CLAUDE.md");
export const SHARED_CLAUDE_DIR = path.join(REPO_ROOT, ".claude");
export const SHARED_SKILLS_DIR = path.join(SHARED_CLAUDE_DIR, "skills");
export const SHARED_AGENTS_DIR = path.join(SHARED_CLAUDE_DIR, "agents");

/** Sentinel markers for the managed .gitignore block written into each project. */
export const GITIGNORE_BLOCK_START = "# >>> deveasy injected config (managed) >>>";
export const GITIGNORE_BLOCK_END = "# <<< deveasy injected config (managed) <<<";

/** Paths DevEasy injects into a selected project, relative to the project root. */
export const INJECTED_RELATIVE_PATHS = [
  "CLAUDE.md",
  ".claude/skills",
  ".claude/agents",
] as const;
