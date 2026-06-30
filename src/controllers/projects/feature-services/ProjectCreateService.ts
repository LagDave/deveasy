import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { loadConfig } from "../../../config";
import { childLogger } from "../../../lib/logger";
import { ProjectModel, type IProject } from "../../../models/ProjectModel";
import { SessionModel } from "../../../models/SessionModel";
import { ConfigInjectionService } from "../../../services/ConfigInjectionService";
import { resolveProjectPath } from "../../../services/PathGuard";
import { ProjectError } from "../feature-utils/ProjectError";

const log = childLogger({ module: "ProjectCreateService" });
const execFileAsync = promisify(execFile);

/**
 * Creates a brand-new project on disk: slugify + path-guard the name, mkdir,
 * `git init`, inject the shared config, then register the project and an opening
 * session. Business logic only — DB access goes through the models, filesystem
 * guarding through PathGuard (Constitution §7.1, §7.4, §5.2).
 */
export class ProjectCreateService {
  /**
   * Create the project directory and its opening session.
   * @param name human-entered display name (e.g. "ACME Portal")
   * @returns the registered project row and the id of its opening session
   */
  static async create(name: string): Promise<{ project: IProject; sessionId: number }> {
    const slug = ProjectCreateService.slugify(name);
    if (!slug) {
      throw new ProjectError("PROJECT_NAME_INVALID", "Project name must contain letters or numbers.", {
        name,
      });
    }

    // §5.2 — guard the slug against traversal / escaping the projects root.
    const targetPath = resolveProjectPath(loadConfig().projectsRoot, slug);

    if (await ProjectCreateService.pathExists(targetPath)) {
      throw new ProjectError("PROJECT_EXISTS", "A project with that name already exists.", { slug });
    }

    log.info({ slug, targetPath }, "Creating new project directory");
    await fs.mkdir(targetPath, { recursive: true });

    await ProjectCreateService.gitInit(targetPath, slug);

    await ConfigInjectionService.inject(targetPath);

    const project = await ProjectModel.upsertByPath(name, targetPath);
    const session = await SessionModel.create(project.id, `Create ${name}`);

    log.info({ slug, projectId: project.id, sessionId: session.id }, "Project created");
    return { project, sessionId: session.id };
  }

  /**
   * Slugify a display name to a filesystem-safe slug: lowercase, spaces and
   * underscores to hyphens, strip to [a-z0-9-], collapse repeats, trim hyphens.
   */
  private static slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private static async pathExists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  /** Run `git init` in the project directory; surface a typed error on failure. */
  private static async gitInit(targetPath: string, slug: string): Promise<void> {
    try {
      await execFileAsync("git", ["init"], { cwd: targetPath });
    } catch (err) {
      log.error({ err, slug, targetPath }, "git init failed for new project");
      throw new ProjectError("PROJECT_GIT_INIT_FAILED", "Could not initialize a git repository.", {
        slug,
      });
    }
  }
}
