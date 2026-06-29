import path from "node:path";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { loadConfig } from "./config";
import { REPO_ROOT } from "./config/constants";
import { destroyDb } from "./database/connection";
import { logger } from "./lib/logger";
import { registerRoutes } from "./routes";

/**
 * DevEasy entry point. Validates config at startup (fail fast, §5.6), serves the
 * API and — in production — the built SPA, all on the configured port.
 */
function createApp(): express.Express {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "2mb" }));
  app.use(pinoHttp({ logger }));

  app.get("/api/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" }, error: null });
  });

  registerRoutes(app);

  // Serve the built frontend in production; in dev the Vite server proxies /api.
  const spaDir = path.join(REPO_ROOT, "frontend", "dist");
  app.use(express.static(spaDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(spaDir, "index.html"));
  });

  return app;
}

function main(): void {
  const config = loadConfig(); // throws on invalid config before we bind a port
  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, "DevEasy listening");
  });

  // <deveasy:websockets> — feature slices needing the live server (Spec 2 session
  // relay) attach here during integration: attachSessionWebSocket(server).
  void server;

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down");
    server.close();
    await destroyDb();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main();

// Exported for integration: feature slices that need a live HTTP server (e.g. the
// WebSocket session relay) attach to the server created in main(). See Spec 2.
export { createApp };
