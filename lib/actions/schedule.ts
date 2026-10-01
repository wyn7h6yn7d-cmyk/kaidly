"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getActivity } from "@/lib/data/schedule";
import { getInstallation } from "@/lib/data/sites";
import { dbErrorCode } from "@/lib/db/errors";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { field, optionalText } from "@/lib/validation/common";
import { LOG_ENTRY_TYPES, occurredAt } from "@/lib/validation/log";
import { activitySchema } from "@/lib/validation/schedule";
import { isUuid } from "@/lib/validation/sites";
import { z } from "zod";
import { actionContext } from "./context";
import { type ActionState, failure, invalidInput } from "./state";

function activityInput(formData: FormData) {
  return activitySchema.safeParse({
    installationId: field(formData, "installationId"),
    title: field(formData, "title"),
    description: field(formData, "description"),
    frequencyType: field(formData, "frequencyType"),
    intervalValue: field(formData, "intervalValue"),
    intervalUnit: field(formData, "intervalUnit"),
    nextDueOn: field(formData, "nextDueOn"),
    responsiblePersonName: field(formData, "responsiblePersonName"),
    priority: field(formData, "priority"),
  });
}

export async function createActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const parsed = activityInput(formData);
  if (!parsed.success) return invalidInput(parsed.error, { interval: t.app.schedule.intervalError });
  const input = parsed.data;

  // The site is the installation's own; the installation must be in this organisation.
  const installation = await getInstallation(ctx.org.id, input.installationId);
  if (!installation) return failure("not_found");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduled_activities")
    .insert({
      organisation_id: ctx.org.id,
      site_id: installation.site.id,
      electrical_installation_id: installation.id,
      title: input.title,
      description: input.description ?? null,
      frequency_type: input.frequencyType,
      interval_value: input.intervalValue,
      interval_unit: input.intervalUnit,
      next_due_on: input.nextDueOn,
      responsible_person_name: input.responsiblePersonName ?? null,
      priority: input.priority,
    })
    .select("id")
    .single();
  if (error || !data) return failure(dbErrorCode(error));
  redirect(`/o/${ctx.org.slug}/kaidukava/${data.id}`);
}

export async function updateActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const activityId = field(formData, "activityId");
  if (!isUuid(activityId)) return failure("not_found");
  const parsed = activityInput(formData);
  if (!parsed.success) return invalidInput(parsed.error, { interval: t.app.schedule.intervalError });
  const input = parsed.data;

  const supabase = await createClient();
  // The installation of an activity never changes; only schedule and description do.
  const { data, error } = await supabase
    .from("scheduled_activities")
    .update({
      title: input.title,
      description: input.description ?? null,
      frequency_type: input.frequencyType,
      interval_value: input.intervalValue,
      interval_unit: input.intervalUnit,
      next_due_on: input.nextDueOn,
      responsible_person_name: input.responsiblePersonName ?? null,
      priority: input.priority,
    })
    .eq("organisation_id", ctx.org.id)
    .eq("id", activityId)
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("not_found");
  redirect(`/o/${ctx.org.slug}/kaidukava/${activityId}`);
}

export async function setActivityArchived(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const activityId = field(formData, "activityId");
  if (!isUuid(activityId)) return failure("not_found");
  const archive = field(formData, "archive") === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduled_activities")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("organisation_id", ctx.org.id)
    .eq("id", activityId)
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("not_found");
  refresh();
  return { ok: true };
}

const completionSchema = z.object({
  activityId: z.uuid(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entryType: z.enum(LOG_ENTRY_TYPES),
  occurredAt,
  description: optionalText(5000),
  result: optionalText(2000),
  performedByName: optionalText(200),
});

export async function completeActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "operator");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const parsed = completionSchema.safeParse({
    activityId: field(formData, "activityId"),
    dueOn: field(formData, "dueOn"),
    entryType: field(formData, "entryType"),
    occurredAt: field(formData, "occurredAt"),
    description: field(formData, "description"),
    result: field(formData, "result"),
    performedByName: field(formData, "performedByName"),
  });
  if (!parsed.success) return invalidInput(parsed.error, { future: t.app.log.futureTime });
  const input = parsed.data;
  // Resolve within the organisation first, so the redirect target is always ours.
  const activity = await getActivity(ctx.org.id, input.activityId);
  if (!activity) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_scheduled_activity", {
    p_activity_id: activity.id,
    p_due_on: input.dueOn,
    p_entry_type: input.entryType,
    p_occurred_at: input.occurredAt,
    p_description: input.description ?? activity.title,
    p_result: input.result,
    p_performed_by_name: input.performedByName,
  });
  if (error) return failure(dbErrorCode(error));
  redirect(`/o/${ctx.org.slug}/kaidukava/${activity.id}?tehtud=1`);
}
