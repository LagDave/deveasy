/** Pure path helpers shared by the editor UI (framework-free, §12.2). */

/** Last path segment, e.g. `src/app/main.ts` → `main.ts`. */
export function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
