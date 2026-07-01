---
name: Run and Preview App
description: >-
  Runs this project's app locally and opens it in the session browser. Use when
  the operator asks to run, start, launch, serve, or preview the app, or to "open
  it in the browser". Starts the backend and frontend dev servers in visible
  session terminals (via the terminal_* tools), waits until the frontend port
  answers, then opens the app with browser_navigate. Reuses already-running
  servers; never installs, builds, migrates, or logs in unless asked.
---

# Run and Preview App

Start this project's dev servers in **session terminals** and open the running app in the **session browser**. Both surfaces are driven through your MCP tools, so the operator watches the terminals boot and the live app appear in the session pane — no hidden background processes.

Tools you use: `terminal_create`, `terminal_run`, `terminal_read`, `terminal_list`, `terminal_close`, and `browser_navigate` (all from the `deveasy` MCP server).

## Steps

1. **Find the run scripts and ports.** Read `package.json` — and `frontend/package.json` if the frontend lives in a subfolder — for the dev scripts. A typical DevEasy full-stack app is an Express/nodemon backend plus a Vite + React frontend. Determine the **frontend dev URL** (Vite defaults to `http://localhost:5173`; check `vite.config.*` for a `server.port` override) and whether a **backend** must run too (the frontend usually proxies `/api` to it).

2. **Reuse what's already running.** Call `terminal_list`. If a terminal is already running a dev server, don't start a duplicate — reuse it and skip to the readiness check.

3. **Start the backend** (if the app has one). `terminal_create`, then `terminal_run` the backend dev script (e.g. `npm run dev`) in that terminal. Dev servers run forever — do **not** wait for the command to "finish".

4. **Start the frontend.** `terminal_create` a second terminal, then `terminal_run` the frontend dev script (the root frontend script, or `npm run dev` inside the frontend folder).

5. **Wait until ready.** Poll `terminal_read` on the frontend terminal until it reports listening (e.g. a `Local:   http://localhost:5173/` or `ready in …` line). Read a few times with short gaps — do not open the browser before the server answers, or you'll land on a connection error.

6. **Open the app.** `browser_navigate` to the frontend URL. The browser pane slides in showing the running app.

7. **Report.** Tell the operator what you started (which terminals, which ports) and that the app is open. If a server failed to boot, share the relevant lines from `terminal_read` — never claim it's up when it isn't.

## Rules

- **Never guess credentials or auto-log-in.** Stop at the app's landing/login page and ask which account to use.
- **Don't install, build, or migrate** unless the operator asks — just start what's already there.
- If scripts or ports are genuinely ambiguous, read the config to resolve them; ask only when you truly can't tell.
- The servers keep running after you finish — they stay in the session pane and the project's TERMINAL tab. Use `terminal_close` only if the operator asks to stop them.
