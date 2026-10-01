/**
 * Role helpers for the UI. These decide what to *show*; the database decides what is
 * *allowed* (RLS, docs/DATABASE.md §5.3). Keep the two in step.
 */

export const ROLES = ["owner", "admin", "operator", "viewer"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { owner: 4, admin: 3, operator: 2, viewer: 1 };

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** True if `role` is at least `min`. */
export function hasRole(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/** May `actor` change or remove a member who currently has `target`? */
export function canManageMember(actor: Role, target: Role): boolean {
  if (!hasRole(actor, "admin")) return false;
  return target !== "owner" || actor === "owner";
}

/** Roles `actor` may assign (to an invitation or an existing member). */
export function assignableRoles(actor: Role): Role[] {
  if (actor === "owner") return [...ROLES];
  if (actor === "admin") return ["admin", "operator", "viewer"];
  return [];
}
