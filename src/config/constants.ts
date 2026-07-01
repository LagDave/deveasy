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

/**
 * Session browser shell — one persistent Playwright Chromium per session
 * (plans/07012026-session-browser-shell). Values named here, not scattered (§4.2).
 */
/** Hard cap on simultaneously live browsers (heavier than PTYs, so lower than MAX_TERMINALS). */
export const MAX_BROWSERS = 4;
/** Suspend a browser (kill process, keep profile) after this long idle with no viewer. */
export const BROWSER_IDLE_MS = 15 * 60 * 1000;
/** How often the idle sweep runs. */
export const BROWSER_EVICTION_INTERVAL_MS = 60 * 1000;
/** Durable per-session Chromium profiles (login survives reload + restart). DevEasy-managed, gitignored. */
export const BROWSER_PROFILES_DIR = path.join(REPO_ROOT, ".deveasy-state", "browser-profiles");
/** In-process MCP endpoint the CLI is pointed at via --mcp-config (not under /api). */
export const BROWSER_MCP_PATH = "/mcp/browser";
/** Per-session --mcp-config files DevEasy writes at CLI spawn. DevEasy-managed, gitignored. */
export const BROWSER_MCP_CONFIG_DIR = path.join(REPO_ROOT, ".deveasy-state", "mcp-configs");
/** Default viewport / screencast geometry. */
export const BROWSER_DEFAULT_VIEWPORT = { width: 1280, height: 800 } as const;
/** JPEG quality for the CDP screencast (1-100); lower trims bandwidth. */
export const BROWSER_SCREENCAST_QUALITY = 60;
/** After the operator interacts, agent tool calls are refused for this grace window (input-contention lock). */
export const BROWSER_HUMAN_CONTROL_GRACE_MS = 5000;
/** Default navigation/action timeout for agent semantic tools. */
export const BROWSER_ACTION_TIMEOUT_MS = 30 * 1000;
