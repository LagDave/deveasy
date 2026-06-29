import type { Project } from "../types";
import { apiGet, apiPost } from "./index";

/** Thin typed functions over the HTTP client — one file per backend domain (§12.1). */

export async function getProjects(): Promise<Project[]> {
  const data = await apiGet<{ projects: Project[] }>("/api/projects");
  return data.projects;
}

export async function getActiveProject(): Promise<Project | null> {
  const data = await apiGet<{ project: Project | null }>("/api/projects/active");
  return data.project;
}

export async function selectProject(projectId: number): Promise<Project> {
  const data = await apiPost<{ project: Project }>("/api/projects/active", { projectId });
  return data.project;
}
