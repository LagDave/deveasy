import type { Project } from "../types";
import { apiGet, apiPost } from "./index";

/** Thin typed functions over the HTTP client — one file per backend domain (§12.1). */

/** The create endpoint scaffolds the dir, opens a session, and returns both. */
export interface CreateProjectResult {
  project: Project;
  sessionId: number;
}

export async function getProjects(): Promise<Project[]> {
  const data = await apiGet<{ projects: Project[] }>("/api/projects");
  return data.projects;
}

export async function createProject(name: string): Promise<CreateProjectResult> {
  return apiPost<CreateProjectResult>("/api/projects", { name });
}
