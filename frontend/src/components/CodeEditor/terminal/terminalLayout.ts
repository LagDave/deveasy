/**
 * Pure layout model for grouped terminals. A tab owns a split tree of panes; each
 * leaf is one backend PTY (by id). Splitting wraps/extends the tree; closing a
 * leaf collapses single-child splits away. This is all frontend state — the
 * backend only knows about flat PTYs — persisted to localStorage so the grouping
 * and names survive a reload (the PTYs themselves already survive on the server).
 */

export type SplitDir = "row" | "col";

export type Pane =
  | { type: "leaf"; terminalId: string }
  | { type: "split"; dir: SplitDir; children: Pane[] };

export interface TermTab {
  id: string;
  name: string;
  layout: Pane;
}

const leaf = (terminalId: string): Pane => ({ type: "leaf", terminalId });

/** All terminal ids contained in a pane subtree, in display order. */
export function collectLeafIds(pane: Pane): string[] {
  return pane.type === "leaf" ? [pane.terminalId] : pane.children.flatMap(collectLeafIds);
}

/** A stable React key for a pane (its leaf id, or the joined ids of a split). */
export function paneKey(pane: Pane): string {
  return pane.type === "leaf" ? pane.terminalId : `s:${collectLeafIds(pane).join(",")}`;
}

/**
 * Split `targetId` in the given direction, inserting `newId` next to it. If the
 * target already sits in a split of the same direction, the new pane is appended
 * as an even sibling; otherwise the target is wrapped in a perpendicular split.
 */
export function splitLeaf(pane: Pane, targetId: string, dir: SplitDir, newId: string): Pane {
  if (pane.type === "leaf") {
    return pane.terminalId === targetId
      ? { type: "split", dir, children: [pane, leaf(newId)] }
      : pane;
  }

  const idx = pane.children.findIndex((c) => c.type === "leaf" && c.terminalId === targetId);
  if (idx !== -1) {
    const children = [...pane.children];
    if (pane.dir === dir) {
      children.splice(idx + 1, 0, leaf(newId));
    } else {
      children[idx] = { type: "split", dir, children: [children[idx], leaf(newId)] };
    }
    return { ...pane, children };
  }

  return { ...pane, children: pane.children.map((c) => splitLeaf(c, targetId, dir, newId)) };
}

/** Remove a leaf; collapse splits that drop to a single child. Returns null if empty. */
export function removeLeaf(pane: Pane, targetId: string): Pane | null {
  if (pane.type === "leaf") return pane.terminalId === targetId ? null : pane;
  const children = pane.children
    .map((c) => removeLeaf(c, targetId))
    .filter((c): c is Pane => c !== null);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { ...pane, children };
}

/** Drop any leaf whose id is not in `liveIds`, collapsing as needed. */
export function pruneToLive(pane: Pane, liveIds: Set<string>): Pane | null {
  if (pane.type === "leaf") return liveIds.has(pane.terminalId) ? pane : null;
  const children = pane.children
    .map((c) => pruneToLive(c, liveIds))
    .filter((c): c is Pane => c !== null);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { ...pane, children };
}
