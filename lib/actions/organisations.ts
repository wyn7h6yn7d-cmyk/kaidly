"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { dbErrorCode } from "@/lib/db/errors";
import { createClient } from "@/lib/supabase/server";
import { field } from "@/lib/validation/common";
import {
  invitationIdSchema,
  invitationSchema,
  inviteTokenSchema,
  memberIdSchema,
  memberRoleSchema,
  organisationSchema,
  organisationSettingsSchema,
  profileSchema,
} from "@/lib/validation/organisations";
import { type ActionState, failure, invalidInput } from "./state";

// Every action re-reads the session through the Supabase server client and runs as the
// user, so RLS decides what is allowed. A write that RLS filters out affects zero rows;
// that is reported as "forbidden" instead of silently succeeding.

export async function createOrganisation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = organisationSchema.safeParse({
    name: field(formData, "name"),
    registryCode: field(formData, "registryCode"),
  });
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("create_organisation", {
    p_name: parsed.data.name,
    p_registry_code: parsed.data.registryCode,
  });
  if (error || !slug) return failure(dbErrorCode(error));
  // ?uus shows the one-time "Ettevõte on valmis" welcome on the overview.
  redirect(`/o/${slug}?uus=1`);
}

export async function updateOrganisation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const organisationId = field(formData, "organisationId");
  const parsed = organisationSettingsSchema.safeParse({
    name: field(formData, "name"),
    registryCode: field(formData, "registryCode"),
    contactEmail: field(formData, "contactEmail"),
    contactPhone: field(formData, "contactPhone"),
    address: field(formData, "address"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) return invalidInput(parsed.error);

  // Owners and admins (RLS + column grants). The slug is never written: the company name
  // is display data, the slug is the stable route identifier.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisations")
    .update({
      name: parsed.data.name,
      registry_code: parsed.data.registryCode ?? null,
      contact_email: parsed.data.contactEmail ?? null,
      contact_phone: parsed.data.contactPhone ?? null,
      address: parsed.data.address ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", organisationId)
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("forbidden");

  refresh();
  return { ok: true };
}

export async function changeMemberRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = memberRoleSchema.safeParse({
    memberId: field(formData, "memberId"),
    role: field(formData, "role"),
  });
  if (!parsed.success) return failure("invalid_input");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisation_members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.memberId)
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("forbidden");

  refresh();
  return { ok: true };
}

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = memberIdSchema.safeParse({ memberId: field(formData, "memberId") });
  if (!parsed.success) return failure("invalid_input");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisation_members")
    .delete()
    .eq("id", parsed.data.memberId)
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("forbidden");

  refresh();
  return { ok: true };
}

export async function leaveOrganisation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const organisationId = field(formData, "organisationId");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisation_members")
    .delete()
    .eq("organisation_id", organisationId)
    .eq("user_id", user.id)
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("not_found");

  redirect("/o?vali=1");
}

export async function createInvitation(
  _prev: ActionState<{ token: string; expiresAt: string }>,
  formData: FormData,
): Promise<ActionState<{ token: string; expiresAt: string }>> {
  await requireUser();
  const parsed = invitationSchema.safeParse({
    organisationId: field(formData, "organisationId"),
    email: field(formData, "email"),
    role: field(formData, "role"),
  });
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_invitation", {
      p_organisation_id: parsed.data.organisationId,
      p_email: parsed.data.email,
      p_role: parsed.data.role,
    })
    .single();
  if (error || !data) return failure(dbErrorCode(error));

  refresh();
  // The plaintext token goes to the inviting admin exactly once and is never stored.
  return { ok: true, data: { token: data.token, expiresAt: data.expires_at } };
}

export async function revokeInvitation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = invitationIdSchema.safeParse({ invitationId: field(formData, "invitationId") });
  if (!parsed.success) return failure("invalid_input");

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", {
    p_invitation_id: parsed.data.invitationId,
  });
  if (error) return failure(dbErrorCode(error));

  refresh();
  return { ok: true };
}

export async function acceptInvitation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = inviteTokenSchema.safeParse(field(formData, "token"));
  if (!parsed.success) return failure("invitation_invalid");

  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("accept_invitation", { p_token: parsed.data });
  if (error || !slug) return failure(dbErrorCode(error));
  redirect(`/o/${slug}`);
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    fullName: field(formData, "fullName"),
    phone: field(formData, "phone"),
  });
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone ?? null })
    .eq("id", user.id)
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("forbidden");

  refresh();
  return { ok: true };
}
