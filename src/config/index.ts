import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";
import {
  DEFAULT_LOG_LEVEL,
  DEFAULT_PORT,
  DEFAULT_PROJECTS_DIRNAME,
  REPO_ROOT,
} from "./constants";

dotenv.config();

/**
 * Configuration schema. Validated at startup; the app fails fast on a missing or
 * malformed value rather than discovering it at request time (Constitution §5.6).
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PROJECTS_ROOT: z.string().optional(),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error"])
    .default(DEFAULT_LOG_LEVEL),
});

export interface AppConfig {
  port: number;
  databaseUrl: string;
  projectsRoot: string;
  logLevel: string;
}

let cached: AppConfig | null = null;

/**
 * Parse and validate the environment once, then cache it. Throws a clear error
 * (listing every offending field) when configuration is invalid.
 */
export function loadConfig(): AppConfig {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid DevEasy configuration:\n${issues}`);
  }

  const env = parsed.data;
  const projectsRoot = env.PROJECTS_ROOT
    ? path.resolve(env.PROJECTS_ROOT)
    : path.join(REPO_ROOT, DEFAULT_PROJECTS_DIRNAME);

  cached = {
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    projectsRoot,
    logLevel: env.LOG_LEVEL,
  };
  return cached;
}
