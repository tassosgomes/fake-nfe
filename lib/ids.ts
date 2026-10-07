import { randomBytes } from "node:crypto";

export function newId(prefix = ""): string {
  const body = randomBytes(16).toString("hex");
  return prefix ? `${prefix}_${body}` : body;
}

export function newToken(prefix: string): string {
  return `${prefix}${randomBytes(24).toString("hex")}`;
}

export function slugify(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "org"}-${randomBytes(3).toString("hex")}`;
}
