"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDeficiency } from "@/lib/data/deficiencies";
import { getInstallation } from "@/lib/data/sites";
import { dbErrorCode } from "@/lib/db/errors";
import { createClient } from "@/lib/supabase/server";
import { field, fieldErrors, optionalText, requiredText } from "@/lib/validation/common";
import { deficiencySchema, progressStatusSchema } from "@/lib/validation/deficiencies";
import { LOG_ENTRY_TYPES, occurredAt } from "@/lib/validation/log";
import { isUuid } from "@/lib/validation/sites";
import { actionContext } from "./context";
import { type ActionState, failure, invalidInput } from "./state";

const DEFICIENCY_MESSAGES = { future: "occurred_in_future", url: "invalid_photos_url" } as const;

function input(formData: FormData) {
  return deficiencySchema.safeParse({
    installationId: field(formData, "installationId"),
    title: field(formData, "title"),
    description: field(formData, "description"),
    severity: field(formData, "severity"),
    detectedAt: field(formData, "detectedAt"),
    responsiblePersonName: field(formData, "responsiblePersonName"),
    dueOn: field(formData, "dueOn"),
    photosUrl: field(formData, "photosUrl"),
  });
}

export async function createDeficiency(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await actionContext(formData, "operator");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const parsed = input(formData);
  if (!parsed.success) return invalidInput(parsed.error, DEFICIENCY_MESSAGES);
  const d = parsed.data;

  const installation = await getInstallation(ctx.org.id, d.installationId);
  if (!installation) return failure("not_found");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deficiencies")
    .insert({
      organisation_id: ctx.org.id,
      site_id: installation.site.id,
      electrical_installation_id: installation.id,
      title: d.title,
      description: d.description,
      severity: d.severity,
      detected_at: d.detectedAt,
      responsible_person_name: d.responsiblePersonName ?? null,
      due_on: d.dueOn ?? null,
      photos_url: d.photosUrl ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return failure(dbErrorCode(error));
  redirect(`/o/${ctx.org.slug}/puudused/${data.id}`);
}

/** Fails with an error code or redirects; it never returns a success value. */
export async function updateDeficiency(_prev: ActionState, formData: FormData): Promise<ActionState<never>> {
  const access = await actionContext(formData, "operator");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const deficiencyId = field(formData, "deficiencyId");
  if (!isUuid(deficiencyId)) return failure("not_found");
  const parsed = input(formData);
  if (!parsed.success) return invalidInput(parsed.error, DEFICIENCY_MESSAGES);
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deficiencies")
    .update({
      title: d.title,
      description: d.description,
      severity: d.severity,
      detected_at: d.detectedAt,
      responsible_person_name: d.responsiblePersonName ?? null,
      due_on: d.dueOn ?? null,
      photos_url: d.photosUrl ?? null,
    })
    .eq("organisation_id", ctx.org.id)
    .eq("id", deficiencyId)
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("not_found");
  redirect(`/o/${ctx.org.slug}/puudused/${deficiencyId}`);
}

export async function setDeficiencyStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "operator");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const deficiencyId = field(formData, "deficiencyId");
  const status = progressStatusSchema.safeParse(field(formData, "status"));
  if (!isUuid(deficiencyId) || !status.success) return failure("invalid_input");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deficiencies")
    .update({ status: status.data })
    .eq("organisation_id", ctx.org.id)
    .eq("id", deficiencyId)
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data?.length) return failure("not_found");
  refresh();
  return { ok: true };
}

const resolutionSchema = z.object({
  deficiencyId: z.uuid(),
  resolution: requiredText(5000),
  entryType: z.enum(LOG_ENTRY_TYPES),
  occurredAt,
  performedByName: optionalText(200),
});

export async function resolveDeficiency(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "operator");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const parsed = resolutionSchema.safeParse({
    deficiencyId: field(formData, "deficiencyId"),
    resolution: field(formData, "resolution"),
    entryType: field(formData, "entryType"),
    occurredAt: field(formData, "occurredAt"),
    performedByName: field(formData, "performedByName"),
  });
  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "resolution")) {
      return failure("resolution_required", fieldErrors(parsed.error));
    }
    return invalidInput(parsed.error, { future: "occurred_in_future" });
  }
  const r = parsed.data;
  const deficiency = await getDeficiency(ctx.org.id, r.deficiencyId);
  if (!deficiency) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_deficiency", {
    p_deficiency_id: deficiency.id,
    p_resolution: r.resolution,
    p_entry_type: r.entryType,
    p_occurred_at: r.occurredAt,
    p_performed_by_name: r.performedByName,
  });
  if (error) return failure(dbErrorCode(error));
  redirect(`/o/${ctx.org.slug}/puudused/${deficiency.id}?lahendatud=1`);
}
