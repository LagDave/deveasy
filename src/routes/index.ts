import { type Express } from "express";
import projectRoutes from "./projects";
import sessionRoutes from "./sessions";
import gitRoutes from "./git";
import azureRoutes from "./azure";
import agentConfigRoutes from "./agentConfig";

/**
 * Central route registry. Each feature slice mounts its router here under /api.
 */
export function registerRoutes(app: Express): void {
  app.use("/api/projects", projectRoutes);
  // <deveasy:routes> — additional feature routers are mounted below this marker.
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/git", gitRoutes);
  app.use("/api/azure", azureRoutes);
  app.use("/api/agent-config", agentConfigRoutes);
}
