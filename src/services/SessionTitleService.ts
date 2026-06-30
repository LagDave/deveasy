import { childLogger } from "../lib/logger";
import { SessionModel } from "../models/SessionModel";
import { ClaudeProcessService } from "./ClaudeProcessService";

const log = childLogger({ module: "SessionTitleService" });

const MAX_TITLE_LENGTH = 48;

/**
 * Auto-names a session from its first prompt by asking the CLI for a short title.
 * Fire-and-forget: a failure just leaves the default "Session #id" name.
 */
export class SessionTitleService {
  static async generateFromFirstPrompt(sessionId: number, firstPrompt: string): Promise<void> {
    try {
      const session = await SessionModel.findById(sessionId);
      if (!session || session.title) return; // already named or gone

      const meta =
        "Reply with ONLY a short, specific title (3-6 words, no quotes, no trailing " +
        "punctuation) for a coding session that begins with this request:\n\n" +
        firstPrompt.slice(0, 2000);

      const raw = await ClaudeProcessService.runHeadless(meta);
      const title = this.sanitize(raw);
      if (title) {
        await SessionModel.updateTitle(sessionId, title);
        log.info({ sessionId, title }, "Session auto-named");
      }
    } catch (err) {
      log.warn({ sessionId, err }, "Auto-naming failed; keeping default title");
    }
  }

  private static sanitize(raw: string): string {
    const firstLine = raw.trim().split("\n")[0] ?? "";
    const cleaned = firstLine.replace(/^["'`#\s-]+|["'`.\s]+$/g, "").trim();
    return cleaned.slice(0, MAX_TITLE_LENGTH);
  }
}
