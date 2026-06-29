import type { Request, Response } from "express";
import { childLogger } from "../../lib/logger";
import {
  AgentConfigService,
  type ConfigType,
  type Frontmatter,
} from "../../services/AgentConfigService";
import { GitCommitService } from "../../services/GitCommitService";
import { handleAgentConfigError, ok } from "./feature-utils/controllerResponses";
import { AgentConfigError } from "./feature-utils/AgentConfigError";

const log = childLogger({ route: "agent-config" });

const VALID_TYPES: readonly ConfigType[] = ["agent", "skill", "claudemd"];

/**
 * Thin controller: validated input -> services -> shaped response. No business
 * logic, no filesystem access here (Constitution §7.3). Validation happens at
 * the boundary (§11.2).
 */
export class AgentConfigController {
  /** GET /api/agent-config — list agents, skills, and the root CLAUDE.md. */
  static async list(_req: Request, res: Response): Promise<Response> {
    try {
      const config = await AgentConfigService.list();
      return ok(res, config);
    } catch (error) {
      return handleAgentConfigError(res, error);
    }
  }

  /** GET /api/agent-config/:type/:name — read one document. */
  static async read(req: Request, res: Response): Promise<Response> {
    try {
      const type = AgentConfigController.parseType(req.params.type);
      const name = AgentConfigController.parseName(req.params.name);
      const document = await AgentConfigService.read(type, name);
      return ok(res, { document });
    } catch (error) {
      return handleAgentConfigError(res, error);
    }
  }

  /** PUT /api/agent-config/:type/:name — create/update, then commit the file. */
  static async write(req: Request, res: Response): Promise<Response> {
    try {
      const type = AgentConfigController.parseType(req.params.type);
      const name = AgentConfigController.parseName(req.params.name);
      const input = AgentConfigController.parseWriteBody(req.body);

      const { document, filePath } = await AgentConfigService.write(type, name, input);
      await GitCommitService.commitFile(filePath, "update");

      log.info({ type, name }, "Saved and committed config");
      return ok(res, { document });
    } catch (error) {
      return handleAgentConfigError(res, error);
    }
  }

  /** DELETE /api/agent-config/:type/:name — delete, then commit the removal. */
  static async remove(req: Request, res: Response): Promise<Response> {
    try {
      const type = AgentConfigController.parseType(req.params.type);
      const name = AgentConfigController.parseName(req.params.name);

      const { filePath } = await AgentConfigService.remove(type, name);
      await GitCommitService.commitFile(filePath, "delete");

      log.info({ type, name }, "Deleted and committed config removal");
      return ok(res, { type, name });
    } catch (error) {
      return handleAgentConfigError(res, error);
    }
  }

  private static parseType(raw: string | undefined): ConfigType {
    if (!raw || !VALID_TYPES.includes(raw as ConfigType)) {
      throw new AgentConfigError("AGENT_CONFIG_TYPE_INVALID", "Unknown config type.", { type: raw });
    }
    return raw as ConfigType;
  }

  private static parseName(raw: string | undefined): string {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      throw new AgentConfigError("AGENT_CONFIG_NAME_INVALID", "A config name is required.", {
        name: raw,
      });
    }
    return raw;
  }

  private static parseWriteBody(body: unknown): { frontmatter: Frontmatter; body: string } {
    const payload = (body ?? {}) as { frontmatter?: unknown; body?: unknown };

    const frontmatter =
      payload.frontmatter && typeof payload.frontmatter === "object" && !Array.isArray(payload.frontmatter)
        ? (payload.frontmatter as Frontmatter)
        : null;
    if (frontmatter === null) {
      throw new AgentConfigError("AGENT_CONFIG_INPUT_INVALID", "frontmatter must be an object.");
    }

    if (typeof payload.body !== "string") {
      throw new AgentConfigError("AGENT_CONFIG_INPUT_INVALID", "body must be a string.");
    }

    return { frontmatter, body: payload.body };
  }
}
