import { diffLines } from "diff";
import type { editor } from "monaco-editor";

/**
 * Compute VS Code–style gutter decorations by line-diffing the file's HEAD version
 * against the live editor buffer. Added lines get a green bar, modified lines an
 * amber bar, and a deletion shows a red triangle at the boundary where lines were
 * removed. A removed block immediately followed by an added block is treated as a
 * modification (the common edit case) rather than a delete + add.
 *
 * `head === null` means the file has no committed version (new/untracked), so every
 * line reads as added.
 */
type Monaco = typeof import("monaco-editor");

const ADDED_CLASS = "gitgutter-added";
const MODIFIED_CLASS = "gitgutter-modified";
const DELETED_CLASS = "gitgutter-deleted";

function lineCount(part: { value: string; count?: number }): number {
  if (typeof part.count === "number") return part.count;
  const n = part.value.split("\n").length;
  // diffLines values usually end in "\n"; drop the trailing empty segment.
  return part.value.endsWith("\n") ? n - 1 : n;
}

export function diffToDecorations(
  head: string | null,
  current: string,
  monaco: Monaco,
): editor.IModelDeltaDecoration[] {
  const decorations: editor.IModelDeltaDecoration[] = [];
  const totalLines = Math.max(1, current.split("\n").length);
  const parts = diffLines(head ?? "", current);

  const lineDeco = (start: number, end: number, className: string): editor.IModelDeltaDecoration => ({
    range: new monaco.Range(start, 1, end, 1),
    options: { isWholeLine: false, linesDecorationsClassName: className },
  });

  let newLine = 1; // 1-based line pointer in the CURRENT document
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const count = lineCount(part);

    if (part.added) {
      if (count > 0) decorations.push(lineDeco(newLine, newLine + count - 1, ADDED_CLASS));
      newLine += count;
    } else if (part.removed) {
      const next = parts[i + 1];
      if (next?.added) {
        // removed-then-added = a modification of those lines
        const addedCount = lineCount(next);
        if (addedCount > 0) {
          decorations.push(lineDeco(newLine, newLine + addedCount - 1, MODIFIED_CLASS));
        }
        newLine += addedCount;
        i += 1; // consume the paired added part
      } else {
        // pure deletion: mark the boundary at the line now occupying that spot
        const marker = Math.min(Math.max(newLine, 1), totalLines);
        decorations.push(lineDeco(marker, marker, DELETED_CLASS));
      }
      // a removed part contributes no lines to the current document
    } else {
      newLine += count; // unchanged
    }
  }

  return decorations;
}
