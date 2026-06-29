import { type Express } from "express";
import projectRoutes from "./projects";

/**
 * Central route registry. Each feature slice mounts its router here under /api.
 * Integration adds one line per slice (sessions, git, azure, agent-config).
 */
export function registerRoutes(app: Express): void {
  app.use("/api/projects", projectRoutes);
  // <deveasy:routes> — additional feature routers are mounted below this marker.
}
