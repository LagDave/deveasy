/**
 * One-command dev launcher: brings up Postgres, applies migrations, then runs the
 * backend (:1234) and the Vite SPA (:5173) together. Run with `npm run dev:all`.
 *
 * In dev you open the Vite server — it serves the SPA with hot reload and proxies
 * /api and /ws to the backend on :1234.
 */
import { spawn, spawnSync } from "node:child_process";

const WEB_URL = "http://localhost:5173";
const API_URL = "http://localhost:1234";

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
    "   DevEasy is starting.",
    "",
    `   ▶  Open the app:   ${WEB_URL}`,
    `      API server:      ${API_URL}   (proxied via /api and /ws)`,
    "",
    "   Press Ctrl+C to stop both servers.",
    "  ============================================================",
    "",
  ].join("\n") + "\n",
);

// 4. Run both dev servers together. Ctrl+C propagates to the process group.
// Pass a single shell string so the quoted sub-commands survive intact.
const child = spawn(
  'npx concurrently -n api,web -c blue,magenta "npm run dev" "npm run frontend:dev"',
  { stdio: "inherit", shell: true },
);
child.on("exit", (code) => process.exit(code ?? 0));
