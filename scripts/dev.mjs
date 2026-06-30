/**
 * One-command dev launcher: brings up Postgres, applies migrations, then runs the
 * backend on :1234. In dev the backend hosts Vite in middleware mode, so the app
 * AND its hot-reload are served on a single port — save a file and it updates
 * instantly, no built files. Run with `npm run dev:all`.
 */
import { spawn, spawnSync } from "node:child_process";

const APP_URL = "http://localhost:1234";

function run(label, cmd, args) {
  process.stdout.write(`\n[dev:all] ${label}…\n`);
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  return res.status === 0;
}

// 1. Postgres (best-effort — if Docker is unavailable, keep going; the backend
//    will simply retry its connection once a database is reachable).
const pgUp = run("starting Postgres (docker compose up -d)", "docker", ["compose", "up", "-d"]);
if (!pgUp) {
  process.stdout.write("[dev:all] WARN: could not start Postgres via Docker. Ensure a database is reachable at DATABASE_URL.\n");
}

// 2. Migrations (idempotent — knex skips already-applied ones). Retry briefly to
//    let a freshly-started Postgres accept connections.
if (pgUp) {
  let migrated = false;
  for (let attempt = 1; attempt <= 3 && !migrated; attempt++) {
    migrated = run(`applying migrations (attempt ${attempt}/3)`, "npm", ["run", "db:migrate"]);
    if (!migrated && attempt < 3) {
      spawnSync("sh", ["-c", "sleep 2"]); // give Postgres a moment to come up
    }
  }
  if (!migrated) {
    process.stdout.write("[dev:all] WARN: migrations did not run. You can run `npm run db:migrate` manually.\n");
  }
}

// 3. Where to visit — printed clearly before the streaming logs start.
process.stdout.write(
  [
    "",
    "  ============================================================",
    "   DevEasy is starting (hot-reload dev).",
    "",
    `   ▶  Open the app:   ${APP_URL}`,
    "      Edit a file and it updates instantly — no rebuild.",
    "",
    "   Press Ctrl+C to stop.",
    "  ============================================================",
    "",
  ].join("\n") + "\n",
);

// 4. Run the backend (which hosts the Vite HMR frontend on the same port).
const child = spawn("npm run dev", { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
