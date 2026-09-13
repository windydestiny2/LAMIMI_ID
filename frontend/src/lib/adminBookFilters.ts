import type { Book } from "./types";

export function filterAdminBookRowsByType(rows: Book[], type: string) {
  if (type === "semua") return rows;
  return rows.filter((b) => b.type === type);
}
