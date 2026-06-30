import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { loadConfig } from "./config";
import { REPO_ROOT } from "./config/constants";
import { destroyDb } from "./database/connection";
import { logger } from "./lib/logger";
import { registerRoutes } from "./routes";
import { attachSessionWebSocket } from "./ws/sessionWebSocket";

const isProduction = process.env.NODE_ENV === "production";

/**
 * DevEasy entry point. Validates config at startup (fail fast, §5.6) and serves
 * everything on one port: the API, the session WebSocket, and the frontend. In
 * production the frontend is the built SPA; in development it is Vite in
 * middleware mode, so saving a file hot-reloads instantly (no built files served).
 */
function createApiApp(): express.Express {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false })); // CSP off so Vite HMR works in dev
  app.use(express.json({ limit: "2mb" }));
  app.use(pinoHttp({ logger }));

  app.get("/api/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" }, error: null });
  });

  registerRoutes(app);
  return app;
}

/** Production: serve the built SPA with an index.html fallback for client routes. */
function mountBuiltFrontend(app: express.Express): void {
  const spaDir = path.join(REPO_ROOT, "frontend", "dist");
  app.use(express.static(spaDir));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(spaDir, "index.html")));
}

/**
 * Development: run Vite in middleware mode against frontend/ so the same port
 * serves the live SPA with HMR. We load the frontend's own Vite (single instance,
 * so its plugins resolve correctly). Falls back to built files if Vite is absent.
 */
async function mountViteFrontend(app: express.Express, server: http.Server): Promise<void> {
  const frontendDir = path.join(REPO_ROOT, "frontend");
  const viteEntry = path.join(frontendDir, "node_modules", "vite", "dist", "node", "index.js");
  // Typed locally so the backend doesn't need Vite's types (Vite lives in frontend/).
  type ViteModule = {
    createServer: (opts: unknown) => Promise<{ middlewares: express.RequestHandler }>;
  };
  try {
    const { createServer } = (await import(pathToFileURL(viteEntry).href)) as ViteModule;
    const vite = await createServer({
      root: frontendDir,
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
    });
    app.use(vite.middlewares);
    logger.info("Vite dev middleware mounted — frontend hot-reload is on");
  } catch (err) {
    logger.warn({ err }, "Vite dev server unavailable; serving built files instead");
    mountBuiltFrontend(app);
  }
}

async function main(): Promise<void> {
  const config = loadConfig(); // throws on invalid config before we bind a port
  const app = createApiApp();
  const server = http.createServer(app);

  // Session WebSocket relay shares the HTTP server (coexists with Vite's HMR ws).
  attachSessionWebSocket(server);

  // Frontend is mounted AFTER the API routes so /api always wins.
  if (isProduction) mountBuiltFrontend(app);
  else await mountViteFrontend(app, server);

  server.listen(config.port, () => {
    logger.info({ port: config.port, mode: isProduction ? "production" : "development" }, "DevEasy listening");
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down");
    server.close();
    await destroyDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
