import { chmodSync, existsSync } from "node:fs";
import { platform } from "node:os";

/**
 * node-pty ships its darwin `spawn-helper` prebuild without the execute bit on
 * some npm extractions, which makes `posix_spawnp` fail at PTY-spawn time. Restore
 * the bit after install so the terminal works out of the box. No-op off darwin
 * (Windows uses conpty and has no spawn-helper).
 */
if (platform() === "darwin") {
  for (const arch of ["darwin-arm64", "darwin-x64"]) {
    const helper = `node_modules/node-pty/prebuilds/${arch}/spawn-helper`;
    if (existsSync(helper)) {
      try {
        chmodSync(helper, 0o755);
      } catch {
        // Best-effort; a failure here only matters if this is the host arch.
      }
    }
  }
}
