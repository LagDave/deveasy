# DevEasy Changelog

All notable changes to DevEasy are documented here.

## [0.1.4] - July 2026

### Native Windows support

DevEasy now runs natively on Windows (PowerShell/cmd) — no WSL2, and no admin rights or Developer Mode. The load-bearing change is config injection: the shared `CLAUDE.md` + `.claude/skills` + `.claude/agents` are linked into each project with **directory junctions and a hardlink** instead of POSIX symlinks, so injection works for a normal user account and Agent Manager edits still propagate live. The dev launcher, Claude CLI spawning, terminal, and shutdown handling were also made cross-platform. POSIX behavior is unchanged.

> **Verification note:** the Windows behavioral acceptance checklist (`plans/07012026-windows-native-support/`) is **deferred** — it cannot be run from the macOS dev environment. The code typechecks and the unit suite passes 70/70; the five Windows checks are waived pending a run on Windows hardware.

**Key Changes:**
- Config injection is platform-aware: junctions for the two folders, hardlink for `CLAUDE.md`, with inode/content idempotency and a cross-volume copy fallback (logged).
- One-command launcher works on Windows: shell-free sleep (no `sh`) and shell-aware spawning so `npm.cmd`/`docker` resolve.
- A new `PATH`×`PATHEXT` executable resolver finds `claude.cmd`, keeping `shell:false` at the spawn sites (no arbitrary prompt through a shell).
- Terminal validates its working directory, falls back to `ComSpec`/PowerShell, and reaps children on `Ctrl+Break` (`SIGBREAK`) as well as `Ctrl+C`.
- README gains a full Windows install + setup guide (winget steps, same-drive `PROJECTS_ROOT` note, console-close caveat).

**Commits:**
- `src/services/ConfigInjectionService.ts` — junction + hardlink injection on Windows; POSIX symlink path unchanged.
- `src/utils/platform.ts` (+ test) — `resolveExecutable` / `resolveViaPathext` PATH×PATHEXT lookup.
- `src/services/ClaudeProcessService.ts` — resolve `claude` at all three spawn sites; `SIGBREAK` reaping.
- `src/services/TerminalProcessService.ts` — `ComSpec`/PowerShell shell, cwd validation, `SIGBREAK`.
- `src/index.ts` — `SIGBREAK` shutdown.
- `scripts/dev.mjs` — `sleepSync` (no `sh`) and shell-aware `spawnSync`.
- `README.md`, `.env.example` — Windows install/setup docs and same-drive note.

## [0.1.3] - July 2026

### One-click workspace tab shortcuts on project headers

Each project header in the Sessions rail now opens the editor takeover straight to the tab you want. The folder icon opens Files, plus new Repo and Terminal icons jump directly to those tabs, alongside the existing new-session (+) button.

**Key Changes:**
- `CodeEditorView` accepts an optional `initialTab` and seeds its active tab from it (the shell remounts per open, so it re-seeds each time).
- `SessionPanel` tracks the requested tab and threads it down via a new `openEditor(projectId, tab)` helper; `onOpenEditor` gained an optional `tab` argument.
- `SessionSidebar` renders Files (folder), Repo (branch), Terminal (terminal), and + (new session) as compact icon buttons; Repo/Terminal pass `"repo"`/`"terminal"`.
- Icons are always visible; the project name truncates with an ellipsis so the icons stay in place for long names and never shift the row.

**Commits:**
- `frontend/src/components/CodeEditor/CodeEditorView.tsx` — `initialTab` prop seeds tab state.
- `frontend/src/components/Session/SessionPanel.tsx` — `editorTab` state + `openEditor` helper, passes `initialTab`.
- `frontend/src/components/Session/SessionSidebar.tsx` — Repo/Terminal/Files/+ icon buttons, always-visible with name truncation.

## [0.1.2] - July 2026

### Tabbed project workspace: REPO git desktop + persistent terminals

The project takeover is now a tabbed workspace — **FILES · REPO · PRS · TERMINAL** — and the separate Cockpit tab is gone. REPO is a GitHub-Desktop-style working view, and TERMINAL hosts real, reload-persistent terminals that can be split and named.

**Key Changes:**
- **Tabbed takeover (`plans/07012026-editor-tabs-shell`):** `CodeEditorView` became a shell over FILES/REPO/PRS/TERMINAL; FILES stays mounted across tab switches so editor state survives. Azure pull-request panels moved into a project-scoped PRS tab; the top-level Cockpit entry, `CockpitPanel.tsx`, and `GitPanel.tsx` were removed.
- **REPO git desktop (`plans/07012026-repo-git-desktop`):** changed-files list with an animated stage checkbox, a Monaco side-by-side HEAD-vs-working diff viewer, a commit bar, and a branch toolbar (themed search-select). `GitService` gained `stage`/`unstage`/`commit`/`createBranch`/`push`/`mergeToMain` — all via `execFile` argv arrays (§5.2), with merge-conflict abort and "merge to main" = local merge + push.
- **Persistent terminals (`plans/07012026-terminal`):** `node-pty` + `@xterm/xterm` multi-instance terminals over a `/ws/terminal` relay, backed by an in-memory PTY registry with scrollback replay. They survive a browser reload and are reaped only on server shutdown. Terminals can be **split** (side by side / stacked, nestable) via per-pane corner icons, **renamed** (double-click a tab), and the layout + names persist to `localStorage`.
- **Terminal typography:** bundled **Comic Code Ligatures** (primary) with **MesloLGL Nerd Font** fallback for powerline/git glyphs, a bar cursor, and tightened letter-spacing.
- **UI kit:** new `ui/Checkbox` (animated) and `ui/SearchSelect` (themed search dropdown) replace native controls.

**Commits:**
- Backend: `src/controllers/git/` (write ops + handlers + routes), `src/services/TerminalProcessService.ts`, `src/ws/terminalWebSocket.ts`, `src/controllers/terminal/`, `src/routes/terminal.ts`, `src/index.ts`, `scripts/fix-node-pty.mjs`.
- Frontend: `components/CodeEditor/` (`CodeEditorView`, `FilesTab`, `RepoTab` + `repo/*`, `PrsTab`, `TerminalTab` + `terminal/*`, `WorkspaceTabs`), `components/ui/{Checkbox,SearchSelect,Icon}.tsx`, `hooks/{useTerminalSocket, queries/useGit, queries/useTerminals}.ts`, `api/{git,terminal}.ts`, `index.css` + bundled fonts in `public/fonts/`.
- Tests: `GitService.test.ts`, `TerminalProcessService.test.ts`, `terminalWebSocket.test.ts`.

## [0.1.1] - July 2026

### Collapsible project lists in the Sessions sidebar

Each project group in the "Sessions by project" rail can now be collapsed to its header, and the choice is remembered across reloads. With several projects the rail no longer grows unbounded — the operator keeps the projects they care about in view.

**Key Changes:**
- Project headers are now a chevron + name toggle that hides the git line and session list when collapsed.
- Collapse state is persisted per project in `localStorage` (`deveasy:sidebar-collapsed-projects`) and survives a page reload.
- The folder (code editor) and new-session (+) buttons sit in their own group, so clicking them no longer toggles collapse.
- `localStorage` reads/writes are wrapped in try/catch — a blocked storage API degrades to an in-memory toggle instead of breaking render.
- Removed the redundant Sessions page header block (eyebrow + title) from the main panel.

**Commits:**
- `frontend/src/components/Session/SessionSidebar.tsx` — collapse toggle, `Set<number>` state seeded from and saved to `localStorage`, conditional render of git info + session list.
- `frontend/src/App.tsx` — removed the per-section page header block.
