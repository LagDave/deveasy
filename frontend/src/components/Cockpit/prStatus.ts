/** Map an Azure PR status string to one of the shared pill variants. */
export function prStatusPill(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed" || s === "merged") return "pill-success";
  if (s === "abandoned") return "pill-danger";
  // open / active and anything else in-flight
  return "pill-accent";
}

/** Strip the refs/heads/ prefix from an Azure branch ref. */
export function shortRef(ref: string): string {
  return ref.replace("refs/heads/", "");
}
