import "server-only";
import { hasRole, type Role } from "@/lib/auth/roles";
import { getOrgContext, type OrgContext } from "@/lib/data/organisations";
import { field } from "@/lib/validation/common";
import { type ActionState, failure } from "./state";

/**
 * Resolves the organisation from the form's `orgSlug` through RLS — never from a
 * client-supplied organisation id — and checks the minimum role for a clear message.
 * The database enforces the same rule independently.
 */
export async function actionContext(
  formData: FormData,
  minRole: Role,
): Promise<{ ok: false; error: ActionState<never> } | { ok: true; ctx: OrgContext }> {
  const ctx = await getOrgContext(field(formData, "orgSlug"));
  if (!ctx) return { ok: false, error: failure("not_found") };
  if (!hasRole(ctx.role, minRole)) return { ok: false, error: failure("forbidden") };
  return { ok: true, ctx };
}
