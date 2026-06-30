import path from "node:path";
import { describe, expect, it } from "vitest";
import { ProjectError } from "../controllers/projects/feature-utils/ProjectError";
import { assertInsideRoot, resolveProjectPath } from "./PathGuard";

/**
 * PathGuard is the §5.2 traversal defense for the create-project flow: every
 * user-supplied project name is resolved through it before any filesystem op.
 * These cover the rejection paths the Done checklist calls out plus the happy
 * path. Pure (no fs/DB) — no mocks needed.
 */
describe("resolveProjectPath", () => {
  const root = "/tmp/deveasy-projects";

  it("accepts a clean slug and returns a direct child of the root", () => {
    expect(resolveProjectPath(root, "acme-portal")).toBe(path.resolve(root, "acme-portal"));
  });

  it.each(["..", "../escape", "a/b", "a\\b", "..\\win"])(
    "rejects names containing traversal or separators: %s",
    (name) => {
      expect(() => resolveProjectPath(root, name)).toThrowError(ProjectError);
    },
  );

  it("rejects an empty name", () => {
    expect(() => resolveProjectPath(root, "")).toThrowError(ProjectError);
  });

  it("tags traversal rejections with PROJECT_PATH_INVALID", () => {
    try {
      resolveProjectPath(root, "../etc");
      throw new Error("expected resolveProjectPath to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ProjectError);
      expect((err as ProjectError).code).toBe("PROJECT_PATH_INVALID");
    }
  });
});

describe("assertInsideRoot", () => {
  const root = "/tmp/deveasy-projects";

  it("passes for a direct child", () => {
    expect(() => assertInsideRoot(root, path.resolve(root, "ok"))).not.toThrow();
  });

  it("throws PROJECT_PATH_OUTSIDE_ROOT for a path outside the root", () => {
    try {
      assertInsideRoot(root, "/tmp/somewhere-else/proj");
      throw new Error("expected assertInsideRoot to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ProjectError);
      expect((err as ProjectError).code).toBe("PROJECT_PATH_OUTSIDE_ROOT");
    }
  });
});
