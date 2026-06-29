import path from "node:path";
import { ProjectError } from "../controllers/projects/feature-utils/ProjectError";

/**
 * Resolve a project path and assert it is a direct child of the projects root
 * before any filesystem operation (Constitution §5.2 — guard against path
 * traversal). Returns the absolute, normalized path.
 */
export function resolveProjectPath(projectsRoot: string, projectName: string): string {
  if (!projectName || projectName.includes("/") || projectName.includes("\\") || projectName.includes("..")) {
    throw new ProjectError("PROJECT_PATH_INVALID", "Invalid project name.", { projectName });
  }
  const root = path.resolve(projectsRoot);
  const resolved = path.resolve(root, projectName);
  const parent = path.dirname(resolved);
  if (parent !== root) {
    throw new ProjectError("PROJECT_PATH_OUTSIDE_ROOT", "Project path escapes the projects root.", {
      projectName,
    });
  }
  return resolved;
}

/** Assert an already-resolved absolute path is a direct child of the root. */
export function assertInsideRoot(projectsRoot: string, absolutePath: string): void {
  const root = path.resolve(projectsRoot);
  const resolved = path.resolve(absolutePath);
  if (path.dirname(resolved) !== root) {
    throw new ProjectError("PROJECT_PATH_OUTSIDE_ROOT", "Path escapes the projects root.", {
      absolutePath,
    });
  }
}
