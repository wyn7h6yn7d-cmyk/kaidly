"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { dbErrorCode } from "@/lib/db/errors";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { field, optionalExternalUrl, requiredText, uuid } from "@/lib/validation/common";
import { actionContext } from "./context";
import { type ActionState, failure, invalidInput } from "./state";

// Periodic audits (docs/AUDITS.md): owners/admins record an audit and set the next
// deadline. The database checks the role and the company again (RLS + trigger).

const day = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => v >= "1990-01-01" && v <= "2200-12-31");
const optionalDay = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(day.optional());

const auditSchema = z.object({
  installationId: uuid,
  auditedOn: day,
  result: requiredText(2000),
  auditor: requiredText(200),
  documentUrl: optionalExternalUrl,
  nextDueOn: optionalDay,
});

/** The installation's site (scoped to the company), or null. */
async function installationSite(organisationId: string, installationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("electrical_installations")
    .select("id, site_id")
    .eq("organisation_id", organisationId)
    .eq("id", installationId)
    .maybeSingle();
  return data;
}

/** One live 'periodic_audit' activity per installation: update its date, or create it. */
async function setNextDeadline(organisationId: string, siteId: string, installationId: string, nextDueOn: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: live } = await supabase
    .from("scheduled_activities")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("electrical_installation_id", installationId)
    .eq("kind", "periodic_audit")
    .is("archived_at", null)
    .maybeSingle();
  if (live) {
    const { data, error } = await supabase
      .from("scheduled_activities")
      .update({ next_due_on: nextDueOn, reminder_days: [90, 30] })
      .eq("id", live.id)
      .select("id");
    if (error) return dbErrorCode(error);
    return data?.length ? null : "forbidden";
  }
  const t = await getT();
  const { error } = await supabase.from("scheduled_activities").insert({
    organisation_id: organisationId,
    site_id: siteId,
    electrical_installation_id: installationId,
    title: t.app.audits.activityTitle,
    frequency_type: "once",
    next_due_on: nextDueOn,
    reminder_days: [90, 30],
    kind: "periodic_audit",
  });
  return error ? dbErrorCode(error) : null;
}

export async function recordAudit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await actionContext(formData, "admin");
  if (!auth.ok) return auth.error;
  const parsed = auditSchema.safeParse({
    installationId: field(formData, "installationId"),
    auditedOn: field(formData, "auditedOn"),
    result: field(formData, "result"),
    auditor: field(formData, "auditor"),
    documentUrl: field(formData, "documentUrl"),
    nextDueOn: field(formData, "nextDueOn"),
  });
  if (!parsed.success) return invalidInput(parsed.error, { url: "invalid_document_url" });
  const org = auth.ctx.org.id;
  const inst = await installationSite(org, parsed.data.installationId);
  if (!inst) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.from("installation_audits").insert({
    organisation_id: org,
    site_id: inst.site_id,
    electrical_installation_id: inst.id,
    audited_on: parsed.data.auditedOn,
    result: parsed.data.result,
    auditor: parsed.data.auditor,
    document_url: parsed.data.documentUrl ?? null,
  });
  if (error) return failure(dbErrorCode(error));
  if (parsed.data.nextDueOn) {
    const code = await setNextDeadline(org, inst.site_id, inst.id, parsed.data.nextDueOn);
    if (code) return failure(code as never);
  }
  refresh();
  return { ok: true };
}

export async function setNextAudit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await actionContext(formData, "admin");
  if (!auth.ok) return auth.error;
  const parsed = z.object({ installationId: uuid, nextDueOn: day }).safeParse({
    installationId: field(formData, "installationId"),
    nextDueOn: field(formData, "nextDueOn"),
  });
  if (!parsed.success) return invalidInput(parsed.error);
  const inst = await installationSite(auth.ctx.org.id, parsed.data.installationId);
  if (!inst) return failure("not_found");
  const code = await setNextDeadline(auth.ctx.org.id, inst.site_id, inst.id, parsed.data.nextDueOn);
  if (code) return failure(code as never);
  refresh();
  return { ok: true };
}

export async function clearNextAudit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await actionContext(formData, "admin");
  if (!auth.ok) return auth.error;
  const parsed = uuid.safeParse(field(formData, "installationId"));
  if (!parsed.success) return failure("invalid_input");
  const supabase = await createClient();
  const { error } = await supabase
    .from("scheduled_activities")
    .update({ archived_at: new Date().toISOString() })
    .eq("organisation_id", auth.ctx.org.id)
    .eq("electrical_installation_id", parsed.data)
    .eq("kind", "periodic_audit")
    .is("archived_at", null);
  if (error) return failure(dbErrorCode(error));
  refresh();
  return { ok: true };
}
