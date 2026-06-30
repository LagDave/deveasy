import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../../../config";
import { childLogger } from "../../../lib/logger";
import { ProjectModel, type IProject } from "../../../models/ProjectModel";

const log = childLogger({ module: "ProjectScanService" });

/**
 * Scans the projects root for direct child directories that are git repos and
 * reconciles them with the registry. Business logic only — DB access goes through
 * the model (Constitution §7.1, §7.4).
 */
export class ProjectScanService {
  /** Return every git-repo directory directly under the projects root. */
  static async scanDisk(): Promise<{ name: string; path: string }[]> {
    const root = loadConfig().projectsRoot;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch (err) {
      // Missing projects/ dir is not fatal — treat as empty and log.
      log.warn({ root, err }, "Projects root not readable; treating as empty");
      return [];
    }

    const found: { name: string; path: string }[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const abs = path.join(root, entry.name);
      const isRepo = await ProjectScanService.isGitRepo(abs);
      if (isRepo) found.push({ name: entry.name, path: abs });
    }
    return found;
  }

  private static async isGitRepo(dir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path.join(dir, ".git"));
      return stat.isDirectory() || stat.isFile();
    } catch {
      return false;
    }
  }

  /** Reconcile disk with the DB and return the current registry. */
  static async sync(): Promise<IProject[]> {
    const onDisk = await ProjectScanService.scanDisk();
    const diskPaths = new Set(onDisk.map((p) => p.path));

    for (const p of onDisk) {
      await ProjectModel.upsertByPath(p.name, p.path);
    }

    const existing = await ProjectModel.list();
    const stale = existing.filter((p) => !diskPaths.has(p.path)).map((p) => p.path);
    await ProjectModel.deleteByPaths(stale);

    return ProjectModel.list();
  }
}
