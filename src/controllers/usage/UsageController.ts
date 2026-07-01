import type { Request, Response } from "express";
import { ClaudeModelsService } from "../../services/ClaudeModelsService";
import { ClaudeUsageService } from "../../services/ClaudeUsageService";
import { handleUsageError, ok } from "./feature-utils/controllerResponses";

/**
 * Thin controller: orchestrates the usage service and shapes the response
 * (Constitution §7.3). The service never throws and never returns the OAuth token,
 * so this just relays its snapshot.
 */
export class UsageController {
  /** GET /api/usage/limits — subscription 5-hour and weekly usage windows. */
  static async getLimits(_req: Request, res: Response): Promise<Response> {
    try {
      const limits = await ClaudeUsageService.getLimits();
      return ok(res, { limits });
    } catch (error) {
      return handleUsageError(res, error);
    }
  }

  /** GET /api/usage/models — the models available to the subscription, with versions. */
  static async getModels(_req: Request, res: Response): Promise<Response> {
    try {
      const catalog = await ClaudeModelsService.getModels();
      return ok(res, { catalog });
    } catch (error) {
      return handleUsageError(res, error);
    }
  }
}
