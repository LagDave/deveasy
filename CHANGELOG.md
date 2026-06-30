# DevEasy Changelog

All notable changes to DevEasy are documented here.

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
