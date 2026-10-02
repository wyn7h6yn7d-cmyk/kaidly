"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { dbErrorCode } from "@/lib/db/errors";
import { LAST_ORG_COOKIE } from "@/lib/org-cookie";
import { createClient } from "@/lib/supabase/server";
import { field } from "@/lib/validation/common";
import { type ActionState, failure } from "./state";

// Organisation lifecycle (docs/DATABASE.md §5a). The database decides everything — owner
// role, typed-name confirmation, and whether the organisation has operational history;
// these actions only pass the input on and route the user afterwards.

const input = z.object({ organisationId: z.uuid(), confirmName: z.string().max(200) });

async function forgetLastOrganisation(slug: string) {
  const store = await cookies();
  if (store.get(LAST_ORG_COOKIE)?.value === slug) store.delete(LAST_ORG_COOKIE);
}

async function run(
  formData: FormData,
  rpc: "delete_organisation" | "deactivate_organisation",
): Promise<ActionState<never>> {
  await requireUser();
  const parsed = input.safeParse({ organisationId: field(formData, "organisationId"), confirmName: field(formData, "confirmName") });
  if (!parsed.success) return failure("confirmation_mismatch", { confirmName: true });
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, {
    p_organisation_id: parsed.data.organisationId,
    p_confirm_name: parsed.data.confirmName,
  });
  if (error) {
    const code = dbErrorCode(error);
    return failure(code, code === "confirmation_mismatch" ? { confirmName: true } : undefined);
  }
  await forgetLastOrganisation(field(formData, "orgSlug"));
  // /o goes to the next active organisation, or shows "no active organisation".
  redirect("/o");
}

/** Permanent deletion — only for organisations without operational history. */
export async function deleteOrganisation(_prev: ActionState, formData: FormData) {
  return run(formData, "delete_organisation");
}

/** Read-only, kept for its history; reversible by an owner. */
export async function deactivateOrganisation(_prev: ActionState, formData: FormData) {
  return run(formData, "deactivate_organisation");
}

export async function reactivateOrganisation(_prev: ActionState, formData: FormData): Promise<ActionState<never>> {
  await requireUser();
  const organisationId = field(formData, "organisationId");
  if (!z.uuid().safeParse(organisationId).success) return failure("not_found");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_organisation", { p_organisation_id: organisationId });
  if (error) return failure(dbErrorCode(error));
  redirect(`/o/${field(formData, "orgSlug")}`);
}
