import * as keytar from "keytar";
import { childLogger } from "../lib/logger";

const log = childLogger({ module: "SecretService" });

/** Keychain service namespace for DevEasy Azure PATs. */
export const AZURE_SECRET_SERVICE = "deveasy-azure";

/**
 * OS-keychain-backed secret store for Azure DevOps PATs (Constitution §5.1/§5.3).
 * The PAT is keyed per Azure organization. It is NEVER written to the DB, logs, or
 * any response — only this module reads/writes the raw token, and only the value
 * (never logged) crosses to azureClient for an Authorization header.
 */
export class SecretService {
  /** Store (or replace) the PAT for an Azure organization. */
  static async setAzurePat(organization: string, pat: string): Promise<void> {
    if (!organization || !pat) {
      throw new Error("setAzurePat requires a non-empty organization and PAT.");
    }
    try {
      await keytar.setPassword(AZURE_SECRET_SERVICE, organization, pat);
      // Never log the PAT itself — only that one was stored, and for whom.
      log.info({ organization }, "Azure PAT stored in keychain");
    } catch (err) {
      log.error({ organization, err }, "Failed to store Azure PAT in keychain");
      throw err;
    }
  }

  /** Read the PAT for an Azure organization, or null if none is stored. */
  static async getAzurePat(organization: string): Promise<string | null> {
    if (!organization) return null;
    try {
      return await keytar.getPassword(AZURE_SECRET_SERVICE, organization);
    } catch (err) {
      log.error({ organization, err }, "Failed to read Azure PAT from keychain");
      throw err;
    }
  }

  /** Remove the stored PAT for an Azure organization. */
  static async deleteAzurePat(organization: string): Promise<boolean> {
    if (!organization) return false;
    try {
      const removed = await keytar.deletePassword(AZURE_SECRET_SERVICE, organization);
      log.info({ organization, removed }, "Azure PAT removal attempted");
      return removed;
    } catch (err) {
      log.error({ organization, err }, "Failed to delete Azure PAT from keychain");
      throw err;
    }
  }
}
