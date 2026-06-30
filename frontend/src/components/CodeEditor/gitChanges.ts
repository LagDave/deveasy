import type { GitStatusFile } from "../../api/git";
import type { ChangeKind } from "../../types";

/**
 * Derived git-change view for the file tree: which files changed (and how) and which
 * ancestor directories contain a change, so the tree can highlight both. Paths are
 * posix and relative to the repo root — which equals the project root for the projects
 * DevEasy manages, so they line up with the editor tree's entry paths.
 */
export interface ChangeMap {
  files: Map<string, ChangeKind>;
  dirs: Set<string>;
}

/** Porcelain XY status → a single change kind (same buckets as the sidebar counts). */
function kindOf(state: string): ChangeKind {
  if (state === "??" || state.includes("A")) return "added";
  if (state.includes("D")) return "deleted";
  return "modified";
}

/** Build the changed-file map + the set of ancestor dirs that contain a change. */
export function buildChangeMap(files: GitStatusFile[] | undefined): ChangeMap {
  const fileMap = new Map<string, ChangeKind>();
  const dirs = new Set<string>();
  for (const f of files ?? []) {
    // Porcelain emits "old -> new" for renames; the working-tree path is the new one.
    const p = f.path.includes(" -> ") ? f.path.split(" -> ")[1] : f.path;
    fileMap.set(p, kindOf(f.state));
    const segments = p.split("/");
    for (let i = 1; i < segments.length; i += 1) {
      dirs.add(segments.slice(0, i).join("/"));
    }
  }
  return { files: fileMap, dirs };
}

/** Tailwind text-color class for a change kind — matches the sidebar git counts. */
export function changeColorClass(kind: ChangeKind | undefined): string {
  if (kind === "added") return "text-success";
  if (kind === "deleted") return "text-danger";
  if (kind === "modified") return "text-accent";
  return "";
}

/** Single-letter badge for a change kind (VS Code-style: A / M / D). */
export function changeBadge(kind: ChangeKind | undefined): string {
  if (kind === "added") return "A";
  if (kind === "deleted") return "D";
  if (kind === "modified") return "M";
  return "";
}
