import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import {
  SHARED_AGENTS_DIR,
  SHARED_CLAUDE_MD,
  SHARED_SKILLS_DIR,
} from "../config/constants";
import { childLogger } from "../lib/logger";
import { AgentConfigError } from "../controllers/agent-config/feature-utils/AgentConfigError";

const log = childLogger({ module: "AgentConfigService" });

/** The three editable config kinds. CLAUDE.md is the single root file. */
export type ConfigType = "agent" | "skill" | "claudemd";

/** The fixed identifier of the single root CLAUDE.md document. */
export const CLAUDE_MD_NAME = "CLAUDE.md";

/** Required frontmatter fields per kind (Constitution §5.2 — validate before write). */
const REQUIRED_FRONTMATTER: Record<"agent" | "skill", readonly string[]> = {
  agent: ["name", "description"],
  skill: ["name", "description"],
};

/** A frontmatter map. Values are unknown until validated — never `any` (§4.5). */
export type Frontmatter = Record<string, unknown>;

/** One entry in the config listing. */
export interface ConfigSummary {
  type: ConfigType;
  /** Stable identifier used in the URL: the file/folder name, or CLAUDE.md. */
  name: string;
  /** Human-facing name from frontmatter, when present. */
  title: string | null;
  description: string | null;
}

/** A fully read config document: parsed frontmatter + markdown body. */
export interface ConfigDocument extends ConfigSummary {
  frontmatter: Frontmatter;
  body: string;
}

/** Input for a create/update write. */
export interface ConfigWriteInput {
  frontmatter: Frontmatter;
  body: string;
}

/**
 * Lists, reads, writes, and deletes the DevEasy-root shared config: subagents in
 * .claude/agents/, skills (folders with SKILL.md) in .claude/skills/, and the
 * root CLAUDE.md. Every operation passes through a strict path guard so a write
 * can never escape the whitelisted config tree (Constitution §5.2). Frontmatter
 * is parsed/serialized with gray-matter and required fields are validated before
 * any write — malformed documents are rejected, never committed.
 */
export class AgentConfigService {
  /** Reject names that could escape the config tree (§5.2). */
  private static assertSafeName(name: string): void {
    if (
      !name ||
      name.includes("/") ||
      name.includes("\\") ||
      name.includes("..") ||
      path.isAbsolute(name)
    ) {
      throw new AgentConfigError("AGENT_CONFIG_NAME_INVALID", "Invalid config name.", { name });
    }
  }

  /**
   * Resolve the absolute file path for a config item and assert it stays inside
   * the whitelisted tree, then return it. This is the single choke point every
   * read/write/delete goes through (§5.2).
   */
  private static resolvePath(type: ConfigType, name: string): string {
    if (type === "claudemd") {
      if (name !== CLAUDE_MD_NAME) {
        throw new AgentConfigError("AGENT_CONFIG_NAME_INVALID", "Invalid CLAUDE.md reference.", {
          name,
        });
      }
      return path.resolve(SHARED_CLAUDE_MD);
    }

    this.assertSafeName(name);

    if (type === "agent") {
      const baseDir = path.resolve(SHARED_AGENTS_DIR);
      const resolved = path.resolve(baseDir, `${name}.md`);
      this.assertInside(baseDir, resolved, name);
      return resolved;
    }

    // skill: each skill is a FOLDER containing SKILL.md.
    const baseDir = path.resolve(SHARED_SKILLS_DIR);
    const resolved = path.resolve(baseDir, name, "SKILL.md");
    this.assertInside(baseDir, resolved, name);
    return resolved;
  }

  /** Assert resolved is inside baseDir; otherwise reject (§5.2). */
  private static assertInside(baseDir: string, resolved: string, name: string): void {
    const withSep = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
    if (!resolved.startsWith(withSep)) {
      throw new AgentConfigError(
        "AGENT_CONFIG_PATH_OUTSIDE_ROOT",
        "Config path escapes the config tree.",
        { name },
      );
    }
  }

  /** Validate required frontmatter fields for agents/skills before write (§5.2). */
  private static validateFrontmatter(type: ConfigType, frontmatter: Frontmatter): void {
    if (type === "claudemd") return;
    const required = REQUIRED_FRONTMATTER[type];
    for (const field of required) {
      const value = frontmatter[field];
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new AgentConfigError(
          "AGENT_CONFIG_FRONTMATTER_INVALID",
          `Missing required frontmatter field "${field}".`,
          { type, field },
        );
      }
    }
  }

  /** Read + parse one file into a ConfigDocument. */
  private static async readDocument(
    type: ConfigType,
    name: string,
    filePath: string,
  ): Promise<ConfigDocument> {
    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch (error) {
      throw new AgentConfigError("AGENT_CONFIG_NOT_FOUND", "Config item not found.", {
        type,
        name,
        cause: (error as Error).message,
      });
    }

    const parsed = matter(raw);
    const frontmatter = parsed.data as Frontmatter;
    return {
      type,
      name,
      title: typeof frontmatter.name === "string" ? frontmatter.name : null,
      description: typeof frontmatter.description === "string" ? frontmatter.description : null,
      frontmatter,
      body: parsed.content.replace(/^\n/, ""),
    };
  }

  /** Build a summary without reading the full body where avoidable. */
  private static toSummary(doc: ConfigDocument): ConfigSummary {
    return {
      type: doc.type,
      name: doc.name,
      title: doc.title,
      description: doc.description,
    };
  }

  /** List all agents, skills, and the root CLAUDE.md (Constitution §3.1 — handled). */
  static async list(): Promise<{
    agents: ConfigSummary[];
    skills: ConfigSummary[];
    claudemd: ConfigSummary | null;
  }> {
    const agents = await this.listAgents();
    const skills = await this.listSkills();
    const claudemd = await this.listClaudeMd();
    return { agents, skills, claudemd };
  }

  private static async listAgents(): Promise<ConfigSummary[]> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(SHARED_AGENTS_DIR, { withFileTypes: true });
    } catch (error) {
      log.warn({ err: error }, "No agents directory yet");
      return [];
    }

    const summaries: ConfigSummary[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const name = entry.name.slice(0, -".md".length);
      const filePath = path.join(SHARED_AGENTS_DIR, entry.name);
      try {
        const doc = await this.readDocument("agent", name, filePath);
        summaries.push(this.toSummary(doc));
      } catch (error) {
        log.warn({ err: error, name }, "Skipping unreadable agent file");
      }
    }
    return summaries;
  }

  private static async listSkills(): Promise<ConfigSummary[]> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(SHARED_SKILLS_DIR, { withFileTypes: true });
    } catch (error) {
      log.warn({ err: error }, "No skills directory yet");
      return [];
    }

    const summaries: ConfigSummary[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const filePath = path.join(SHARED_SKILLS_DIR, entry.name, "SKILL.md");
      try {
        const doc = await this.readDocument("skill", entry.name, filePath);
        summaries.push(this.toSummary(doc));
      } catch (error) {
        log.warn({ err: error, name: entry.name }, "Skipping skill without readable SKILL.md");
      }
    }
    return summaries;
  }

  private static async listClaudeMd(): Promise<ConfigSummary | null> {
    try {
      const doc = await this.readDocument("claudemd", CLAUDE_MD_NAME, path.resolve(SHARED_CLAUDE_MD));
      return this.toSummary(doc);
    } catch (error) {
      log.warn({ err: error }, "No root CLAUDE.md yet");
      return null;
    }
  }

  /** Read one config document by type + name. */
  static async read(type: ConfigType, name: string): Promise<ConfigDocument> {
    const filePath = this.resolvePath(type, name);
    return this.readDocument(type, name, filePath);
  }

  /**
   * Create or update a config document: validate frontmatter, serialize with
   * gray-matter, and write. Returns the absolute path written so the caller can
   * stage exactly that file for commit. (Constitution §3.1 — every async handled.)
   */
  static async write(
    type: ConfigType,
    name: string,
    input: ConfigWriteInput,
  ): Promise<{ document: ConfigDocument; filePath: string }> {
    const filePath = this.resolvePath(type, name);
    this.validateFrontmatter(type, input.frontmatter);

    const serialized =
      type === "claudemd" && Object.keys(input.frontmatter).length === 0
        ? this.normalizeBody(input.body)
        : matter.stringify(this.normalizeBody(input.body), input.frontmatter);

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, serialized, "utf8");
    } catch (error) {
      throw new AgentConfigError("AGENT_CONFIG_WRITE_FAILED", "Failed to write config file.", {
        type,
        name,
        cause: (error as Error).message,
      });
    }

    log.info({ type, name, filePath }, "Wrote config file");
    const document = await this.readDocument(type, name, filePath);
    return { document, filePath };
  }

  /**
   * Delete a config item. For skills, removes the whole skill folder. Returns the
   * absolute path removed (the file, or the skill dir) so it can be staged.
   */
  static async remove(type: ConfigType, name: string): Promise<{ filePath: string }> {
    if (type === "claudemd") {
      throw new AgentConfigError(
        "AGENT_CONFIG_DELETE_FORBIDDEN",
        "The root CLAUDE.md cannot be deleted.",
        { name },
      );
    }

    const filePath = this.resolvePath(type, name);
    try {
      await fs.access(filePath);
    } catch {
      throw new AgentConfigError("AGENT_CONFIG_NOT_FOUND", "Config item not found.", { type, name });
    }

    try {
      if (type === "skill") {
        // Remove the whole skill folder, not just SKILL.md.
        const skillDir = path.dirname(filePath);
        await fs.rm(skillDir, { recursive: true, force: true });
        log.info({ type, name, skillDir }, "Deleted skill folder");
        return { filePath: skillDir };
      }
      await fs.unlink(filePath);
      log.info({ type, name, filePath }, "Deleted agent file");
      return { filePath };
    } catch (error) {
      throw new AgentConfigError("AGENT_CONFIG_DELETE_FAILED", "Failed to delete config item.", {
        type,
        name,
        cause: (error as Error).message,
      });
    }
  }

  /** Ensure the body ends with exactly one trailing newline. */
  private static normalizeBody(body: string): string {
    return `${body.replace(/\s+$/, "")}\n`;
  }
}
