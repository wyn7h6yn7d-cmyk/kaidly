"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorCode } from "@/lib/db/errors";
import { createClient } from "@/lib/supabase/server";
import { field } from "@/lib/validation/common";
import { installationSchema, isUuid, siteSchema } from "@/lib/validation/sites";
import { actionContext } from "./context";
import { type ActionState, failure, invalidInput } from "./state";

function siteInput(formData: FormData) {
  return siteSchema.safeParse({
    name: field(formData, "name"),
    address: field(formData, "address"),
    description: field(formData, "description"),
    responsiblePerson: field(formData, "responsiblePerson"),
  });
}

function installationInput(formData: FormData) {
  return installationSchema.safeParse({
    siteId: field(formData, "siteId"),
    name: field(formData, "name"),
    identifier: field(formData, "identifier"),
    installationType: field(formData, "installationType"),
    location: field(formData, "location"),
    description: field(formData, "description"),
    commissionedOn: field(formData, "commissionedOn"),
    status: field(formData, "status"),
    responsiblePerson: field(formData, "responsiblePerson"),
    notes: field(formData, "notes"),
  });
}

export async function createSite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const parsed = siteInput(formData);
  if (!parsed.success) return invalidInput(parsed.error, { future: "future_date" });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .insert({
      organisation_id: ctx.org.id,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      description: parsed.data.description ?? null,
      responsible_person: parsed.data.responsiblePerson ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return failure(dbErrorCode(error));
  redirect(`/o/${ctx.org.slug}/objektid/${data.id}`);
}

export async function updateSite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const siteId = field(formData, "siteId");
  if (!isUuid(siteId)) return failure("not_found");
  const parsed = siteInput(formData);
  if (!parsed.success) return invalidInput(parsed.error, { future: "future_date" });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .update({
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      description: parsed.data.description ?? null,
      responsible_person: parsed.data.responsiblePerson ?? null,
    })
    .eq("organisation_id", ctx.org.id)
    .eq("id", siteId)
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("not_found");
  redirect(`/o/${ctx.org.slug}/objektid/${siteId}`);
}

export async function setSiteArchived(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const siteId = field(formData, "siteId");
  if (!isUuid(siteId)) return failure("not_found");
  const archive = field(formData, "archive") === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("organisation_id", ctx.org.id)
    .eq("id", siteId)
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("not_found");

  if (archive) redirect(`/o/${ctx.org.slug}/objektid`);
  refresh();
  return { ok: true };
}

export async function createInstallation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const parsed = installationInput(formData);
  if (!parsed.success) return invalidInput(parsed.error, { future: "future_date" });
  const input = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("electrical_installations")
    .insert({
      organisation_id: ctx.org.id,
      site_id: input.siteId,
      name: input.name,
      identifier: input.identifier ?? null,
      installation_type: input.installationType,
      location: input.location ?? null,
      description: input.description ?? null,
      commissioned_on: input.commissionedOn ?? null,
      status: input.status,
      responsible_person: input.responsiblePerson ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return failure(dbErrorCode(error));
  redirect(`/o/${ctx.org.slug}/paigaldised/${data.id}`);
}

export async function updateInstallation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const installationId = field(formData, "installationId");
  if (!isUuid(installationId)) return failure("not_found");
  const parsed = installationInput(formData);
  if (!parsed.success) return invalidInput(parsed.error, { future: "future_date" });
  const input = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("electrical_installations")
    .update({
      site_id: input.siteId,
      name: input.name,
      identifier: input.identifier ?? null,
      installation_type: input.installationType,
      location: input.location ?? null,
      description: input.description ?? null,
      commissioned_on: input.commissionedOn ?? null,
      status: input.status,
      responsible_person: input.responsiblePerson ?? null,
      notes: input.notes ?? null,
    })
    .eq("organisation_id", ctx.org.id)
    .eq("id", installationId)
    .select("id");
  // Moving an installation that has operating records to another site fails with
  // has_dependent_records: its history stays with the site where it happened.
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("not_found");
  redirect(`/o/${ctx.org.slug}/paigaldised/${installationId}`);
}

export async function setInstallationArchived(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const installationId = field(formData, "installationId");
  if (!isUuid(installationId)) return failure("not_found");
  const archive = field(formData, "archive") === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("electrical_installations")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("organisation_id", ctx.org.id)
    .eq("id", installationId)
    .select("id, site_id");
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("not_found");

  if (archive) redirect(`/o/${ctx.org.slug}/objektid/${data[0].site_id}`);
  refresh();
  return { ok: true };
}
