# DevEasy

A local-first web app that wraps the **Claude Code CLI** so a team shares one
version-controlled set of agents, skills, and `CLAUDE.md` — with a chat workspace,
a code editor, and an Azure/git cockpit, all on `localhost:1234`.

Everyone runs their own copy; sharing happens through git. Sessions run on **your
Claude subscription** (the CLI's cached login), not API credits.

---

## Prerequisites

- **Node 20+** and **npm**
- **Docker** (for the local Postgres)
- **Claude Code CLI**, logged in: run `claude` once and sign in.
  Do **not** set `ANTHROPIC_API_KEY` — that would switch sessions to paid API billing.

## Quick start

```bash
# 1. install
npm install
npm --prefix frontend install

# 2. run everything (Postgres + migrations + app, with hot reload)
npm run dev:all
```

Then open **http://localhost:1234**. Editing a file hot-reloads instantly.

> `dev:all` brings up the Docker Postgres on `:1231`, applies migrations, and serves
> the API + UI on `:1234`. Stop with `Ctrl+C`.

---

## Track an existing project

DevEasy works on the git repos inside its **`projects/`** folder (gitignored, so your
client code never lands in this repo).

1. Clone or move a repo into `projects/`:
   ```bash
   git clone <your-repo> projects/my-app
   ```
2. It appears automatically under **Projects** and in the **Sessions** rail —
   no "open" step, no activation.

## Start a new project

In the **Projects** tab, click **Create new project**. The wizard scaffolds a fresh
project, runs `git init`, and opens a session against it so you can start building
right away.

---

## Using it

**Sessions** — chat with Claude against a project. Every message must begin with a
**workflow command** (type it or pick from the **Command** menu); it renders as a
colored badge:

| | | | |
|---|---|---|---|
| `-a` ask | `-s` plan | `-x` execute | `-c` continue |
| `-b` explore | `-q` quickfix | `-r` review | `-st` status |

Sessions keep running in the background — switching away or closing the tab doesn't
cancel them. The rail shows each session's state (working / ready) per project.

**Cockpit** — pick a project to see its git history and Azure pull requests, and to
open a PR. Paste a per-user Azure **PAT** in settings (stored in your OS keychain —
never committed).

**Agents** — edit the shared `CLAUDE.md`, skills, and subagents. Saving commits the
change to this repo; teammates get it on `git pull`, and DevEasy injects the config
into each project automatically.

---

## How sharing works

The agent config (`CLAUDE.md`, `.claude/skills`, `.claude/agents`) lives in **this
repo**. When you open a project, DevEasy symlinks that config in (gitignored in the
project), so the whole team runs the same agents. Push your changes; teammates pull
to stay in sync.
