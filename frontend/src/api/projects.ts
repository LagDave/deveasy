import type { Project } from "../types";
import { apiGet } from "./index";

/** Thin typed functions over the HTTP client — one file per backend domain (§12.1). */

export async function getProjects(): Promise<Project[]> {
  const data = await apiGet<{ projects: Project[] }>("/api/projects");
  return data.projects;
}
