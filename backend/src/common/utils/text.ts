export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive "contains" regex for user-supplied search text. */
export function searchRegex(value: string): RegExp {
  return new RegExp(escapeRegex(value.trim().slice(0, 100)), "i");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 60);
}

/** Gate id convention used by the frontend: "Gate 1 (Main)" -> "gate_1". */
export function gateIdFromName(name: string): string {
  const base = name.replace(/\(.*?\)/g, "").trim().toLowerCase();
  return base.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
