"use server";

import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { getInstallation } from "@/lib/data/sites";
import { dbErrorCode } from "@/lib/db/errors";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { field, fieldErrors } from "@/lib/validation/common";
import { correctionSchema, logEntrySchema } from "@/lib/validation/log";
import { actionContext } from "./context";
import { type ActionState, failure } from "./state";

// Organisation, site and installation are never taken from the form: the organisation
// comes from the URL slug (RLS), the installation is looked up inside it, and the site is
// the installation's own. The database enforces the same consistency with composite keys.

function input(formData: FormData) {
  return {
    installationId: field(formData, "installationId"),
    entryType: field(formData, "entryType"),
    occurredAt: field(formData, "occurredAt"),
    description: field(formData, "description"),
    result: field(formData, "result"),
    performedByName: field(formData, "performedByName"),
  };
}

function invalid(error: ZodError): ActionState {
  const messages = error.issues.map((issue) => issue.message);
  const message = messages.includes("future")
    ? t.app.log.futureTime
    : messages.includes("time")
      ? t.app.log.invalidTime
      : t.errors.invalid_input;
  return { ok: false, error: message, fields: fieldErrors(error) };
}

export async function createLogEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "operator");
  if (!access.ok) return access.error;
  const { ctx } = access;

  const parsed = logEntrySchema.safeParse(input(formData));
  if (!parsed.success) return invalid(parsed.error);
  const entry = parsed.data;

  const installation = await getInstallation(ctx.org.id, entry.installationId);
  if (!installation) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.from("log_entries").insert({
    organisation_id: ctx.org.id,
    site_id: installation.site.id,
    electrical_installation_id: installation.id,
    entry_type: entry.entryType,
    occurred_at: entry.occurredAt,
    description: entry.description,
    result: entry.result ?? null,
    performed_by_name: entry.performedByName ?? null,
  });
  if (error) return failure(dbErrorCode(error));

  redirect(`/o/${ctx.org.slug}/paigaldised/${installation.id}/paevik?salvestatud=1`);
}

export async function correctLogEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "operator");
  if (!access.ok) return access.error;
  const { ctx } = access;

  const parsed = correctionSchema.safeParse({
    ...input(formData),
    correctionOfId: field(formData, "correctionOfId"),
    correctionReason: field(formData, "correctionReason"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const entry = parsed.data;

  const supabase = await createClient();
  // The original must be visible to the user and belong to this organisation and
  // installation; it supplies the site and installation for the correction.
  const { data: original, error: readError } = await supabase
    .from("log_entries")
    .select("id, site_id, electrical_installation_id")
    .eq("organisation_id", ctx.org.id)
    .eq("electrical_installation_id", entry.installationId)
    .eq("id", entry.correctionOfId)
    .is("correction_of_id", null)
    .maybeSingle();
  if (readError) return failure(dbErrorCode(readError));
  if (!original) return failure("not_found");

  const { error } = await supabase.from("log_entries").insert({
    organisation_id: ctx.org.id,
    site_id: original.site_id,
    electrical_installation_id: original.electrical_installation_id,
    entry_type: entry.entryType,
    occurred_at: entry.occurredAt,
    description: entry.description,
    result: entry.result ?? null,
    performed_by_name: entry.performedByName ?? null,
    correction_of_id: original.id,
    correction_reason: entry.correctionReason,
  });
  if (error) return failure(dbErrorCode(error));

  redirect(`/o/${ctx.org.slug}/paigaldised/${original.electrical_installation_id}/paevik/${original.id}`);
}
