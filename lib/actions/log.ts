"use server";

import { getInstallation } from "@/lib/data/sites";
import { dbErrorCode } from "@/lib/db/errors";
import { createClient } from "@/lib/supabase/server";
import { field } from "@/lib/validation/common";
import { correctionSchema, logEntrySchema } from "@/lib/validation/log";
import { actionContext } from "./context";
import { savedOrRedirect } from "./saved";
import { type ActionState, failure, invalidInput, type SavedRecord } from "./state";

const LOG_TIME_MESSAGES = { future: "occurred_in_future", time: "invalid_time" } as const;

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

export async function createLogEntry(
  _prev: ActionState<SavedRecord>,
  formData: FormData,
): Promise<ActionState<SavedRecord>> {
  const access = await actionContext(formData, "operator");
  if (!access.ok) return access.error;
  const { ctx } = access;

  const parsed = logEntrySchema.safeParse(input(formData));
  if (!parsed.success) return invalidInput(parsed.error, LOG_TIME_MESSAGES);
  const entry = parsed.data;

  const installation = await getInstallation(ctx.org.id, entry.installationId);
  if (!installation) return failure("not_found");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("log_entries")
    .insert({
      organisation_id: ctx.org.id,
      site_id: installation.site.id,
      electrical_installation_id: installation.id,
      entry_type: entry.entryType,
      occurred_at: entry.occurredAt,
      description: entry.description,
      result: entry.result ?? null,
      performed_by_name: entry.performedByName ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return failure(dbErrorCode(error));

  return savedOrRedirect(formData, data.id, `/o/${ctx.org.slug}/paigaldised/${installation.id}/paevik?salvestatud=1`);
}

export async function correctLogEntry(
  _prev: ActionState<SavedRecord>,
  formData: FormData,
): Promise<ActionState<SavedRecord>> {
  const access = await actionContext(formData, "operator");
  if (!access.ok) return access.error;
  const { ctx } = access;

  const parsed = correctionSchema.safeParse({
    ...input(formData),
    correctionOfId: field(formData, "correctionOfId"),
    correctionReason: field(formData, "correctionReason"),
  });
  if (!parsed.success) return invalidInput(parsed.error, LOG_TIME_MESSAGES);
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

  const { data, error } = await supabase
    .from("log_entries")
    .insert({
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
    })
    .select("id")
    .single();
  if (error || !data) return failure(dbErrorCode(error));

  return savedOrRedirect(
    formData,
    data.id,
    `/o/${ctx.org.slug}/paigaldised/${original.electrical_installation_id}/paevik/${original.id}`,
  );
}
