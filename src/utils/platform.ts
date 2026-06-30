import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolve an executable name to a runnable path. On Windows a bare command like
 * `claude` or `npm` is really `claude.cmd` / `npm.cmd`, which Node's spawn cannot
 * find with `shell:false`. Walking `PATH` × `PATHEXT` recovers the real file so the
 * spawn sites can keep `shell:false` — no arbitrary arguments are ever passed
 * through a shell (Constitution §5.2). On POSIX the name is returned unchanged.
 * Results are cached per name for the process lifetime.
 */

/** Executable extensions probed on Windows, in order, when `PATHEXT` is unset (§4.2). */
const DEFAULT_WINDOWS_PATHEXT = ".COM;.EXE;.BAT;.CMD";

const cache = new Map<string, string>();

/** Resolve `name` to a spawnable path (Windows-aware), caching the result. */
export function resolveExecutable(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const resolved =
    process.platform === "win32"
      ? resolveViaPathext(name, process.env.PATH, process.env.PATHEXT)
      : name;

  cache.set(name, resolved);
  return resolved;
}

/**
 * Pure `PATH` × `PATHEXT` lookup — exported for tests so it can be exercised off
 * Windows. A name that is already a path or already carries an extension is used
 * as-is. Returns the first existing candidate, or the bare name if none match (the
 * spawn then surfaces a clear ENOENT).
 */
export function resolveViaPathext(
  name: string,
  pathVar: string | undefined,
  pathextVar: string | undefined,
): string {
  if (name.includes("/") || name.includes("\\") || path.extname(name)) return name;

  const pathDirs = (pathVar ?? "").split(path.delimiter).filter(Boolean);
  const exts = (pathextVar || DEFAULT_WINDOWS_PATHEXT)
    .split(";")
    .map((ext) => ext.trim())
    .filter(Boolean);

  for (const dir of pathDirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, `${name}${ext}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return name;
}
