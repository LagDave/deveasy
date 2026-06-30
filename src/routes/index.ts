import { type Express } from "express";
import projectRoutes from "./projects";
import sessionRoutes from "./sessions";
import gitRoutes from "./git";
import editorRoutes from "./editor";
import azureRoutes from "./azure";
import agentConfigRoutes from "./agentConfig";
import terminalRoutes from "./terminal";

/**
 * Central route registry. Each feature slice mounts its router here under /api.
 */
export function registerRoutes(app: Express): void {
  app.use("/api/projects", projectRoutes);
  // <deveasy:routes> — additional feature routers are mounted below this marker.
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/git", gitRoutes);
  app.use("/api/editor", editorRoutes);
  app.use("/api/azure", azureRoutes);
  app.use("/api/agent-config", agentConfigRoutes);
  app.use("/api/terminal", terminalRoutes);
}
