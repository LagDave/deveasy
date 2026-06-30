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

## Windows (native)

DevEasy runs natively on Windows in PowerShell or `cmd` — **no WSL2 required, and no
admin rights or Developer Mode.**

### 1. Install the prerequisites (one time)

The quickest path uses [winget](https://learn.microsoft.com/windows/package-manager/winget/)
(built into Windows 10/11). Run in PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS      # Node 20+ and npm
winget install Git.Git                 # git
winget install Docker.DockerDesktop    # local Postgres host
```

Then install the **Claude Code CLI** (puts `claude` on your `PATH`):

```powershell
npm install -g @anthropic-ai/claude-code
```

Close and reopen PowerShell so the new `PATH` is picked up, then confirm each tool:

```powershell
node -v        # v20+
git --version
claude --version
docker --version
```

### 2. Log in to Claude (one time)

```powershell
claude          # follow the prompt to sign in to your subscription
```

Do **not** set `ANTHROPIC_API_KEY` — that would switch sessions to paid API billing.
Make sure **Docker Desktop is running** before the next step.

### 3. Run DevEasy

```powershell
git clone <your-deveasy-repo> deveasy
cd deveasy
npm install
npm --prefix frontend install
copy .env.example .env   # adjust if needed
npm run dev:all
```

Then open **http://localhost:1234**. `Ctrl+C` stops it.

**How config injection works on Windows.** DevEasy shares one `CLAUDE.md` +
`.claude/skills` + `.claude/agents` across your projects. On Windows it links these in
with **directory junctions** (the two folders) and a **hardlink** (`CLAUDE.md`) — both
work without elevated privileges, and edits you make in the Agent Manager show up live
in open projects.

> **Keep `PROJECTS_ROOT` on the same drive as the DevEasy repo.** Hardlinks can't span
> volumes; if your projects live on a different drive, `CLAUDE.md` is **copied** instead
> of linked, and changes to the shared file won't appear in a project until you re-open
> it. (Junctions for the two folders still work across drives.)

> **Closing the console window** (the `X` button) can't be trapped cleanly on Windows, so
> it may leave a `claude` or terminal child process behind. Stop the server with `Ctrl+C`
> (or `Ctrl+Break`) instead — both reap child processes.

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
