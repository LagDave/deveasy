# DevEasy Changelog

All notable changes to DevEasy are documented here.

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
