import "server-only";
import { createClient } from "@/lib/supabase/server";
import { localInputToIso, todayInTallinn } from "@/lib/time";
import { defaultPeriodStart, type AuditPackageData } from "@/lib/reports/audit-package";

// Periodic audits (docs/AUDITS.md). Reads through the user's own session: members and the
// site's viewers see the rows (RLS), nobody else.

export type InstallationAudit = {
  id: string;
  auditedOn: string;
  result: string;
  auditor: string;
  documentUrl: string | null;
  createdByName: string;
};

export async function getInstallationAudits(organisationId: string, installationId: string) {
  const supabase = await createClient();
  const [audits, next] = await Promise.all([
    supabase
      .from("installation_audits")
      .select("id, audited_on, result, auditor, document_url, created_by_name")
      .eq("organisation_id", organisationId)
      .eq("electrical_installation_id", installationId)
      .order("audited_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("scheduled_activities")
      .select("id, next_due_on")
      .eq("organisation_id", organisationId)
      .eq("electrical_installation_id", installationId)
      .eq("kind", "periodic_audit")
      .is("archived_at", null)
      .maybeSingle(),
  ]);
  if (audits.error) throw audits.error;
  if (next.error) throw next.error;
  return {
    audits: (audits.data ?? []).map(
      (a): InstallationAudit => ({
        id: a.id,
        auditedOn: a.audited_on,
        result: a.result,
        auditor: a.auditor,
        documentUrl: a.document_url,
        createdByName: a.created_by_name,
      }),
    ),
    next: next.data ? { activityId: next.data.id, nextDueOn: next.data.next_due_on } : null,
  };
}

/** The nearest live audit deadline of a site's installations (members or viewers). */
export async function getSiteNearestAudit(siteId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduled_activities")
    .select("next_due_on, electrical_installation_id")
    .eq("site_id", siteId)
    .eq("kind", "periodic_audit")
    .is("archived_at", null)
    .not("next_due_on", "is", null)
    .order("next_due_on")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.next_due_on) return null;
  const { data: i } = await supabase
    .from("electrical_installations")
    .select("name, identifier")
    .eq("id", data.electrical_installation_id)
    .maybeSingle();
  return { nextDueOn: data.next_due_on, installation: [i?.identifier, i?.name].filter(Boolean).join(" ") };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const nextDay = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Everything the audit package shows for one site, read with RLS. `from`/`to` are optional
 * YYYY-MM-DD days (Tallinn); without `from` the period starts from the installations' last
 * audit (else 12 months back). Null when the site is not readable.
 */
export async function loadAuditPackage(
  org: { id: string; name: string },
  siteId: string,
  period: { from?: string | null; to?: string | null },
): Promise<AuditPackageData | null> {
  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, name, address, responsible_person")
    .eq("organisation_id", org.id)
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return null;
  const today = todayInTallinn();

  const [installations, audits, plan, deficiencies, documents] = await Promise.all([
    supabase.from("electrical_installations").select("id, name, identifier").eq("site_id", site.id).is("archived_at", null).order("name").order("id"),
    supabase.from("installation_audits").select("electrical_installation_id, audited_on, result, auditor, document_url").eq("site_id", site.id).order("audited_on"),
    supabase
      .from("scheduled_activities")
      .select("title, electrical_installation_id, next_due_on, frequency_type, responsible_person_name, kind")
      .eq("site_id", site.id)
      .is("archived_at", null)
      .order("next_due_on", { nullsFirst: false })
      .order("id"),
    supabase
      .from("deficiencies")
      .select("title, electrical_installation_id, severity, status, detected_at, due_on, resolution, resolved_at, photos_url")
      .eq("site_id", site.id)
      .order("detected_at")
      .order("id"),
    supabase
      .from("documents")
      .select("title, category, electrical_installation_id, external_url")
      .eq("site_id", site.id)
      .not("external_url", "is", null)
      .is("archived_at", null)
      .order("title")
      .order("id"),
  ]);
  for (const r of [installations, audits, plan, deficiencies, documents]) if (r.error) throw r.error;

  const auditRows = (audits.data ?? []).map((a) => ({
    installationId: a.electrical_installation_id,
    auditedOn: a.audited_on,
    result: a.result,
    auditor: a.auditor,
    documentUrl: a.document_url,
  }));
  const from = period.from && DAY.test(period.from) ? period.from : defaultPeriodStart(auditRows, today);
  const to = period.to && DAY.test(period.to) && period.to >= from ? period.to : today;

  // The log of the period, plus the originals of any correction in it.
  const { data: log, error: logError } = await supabase
    .from("log_entries")
    .select("id, occurred_at, entry_type, description, result, created_by_name, performed_by_name, correction_of_id, correction_reason, electrical_installation_id, photos_url")
    .eq("site_id", site.id)
    .gte("occurred_at", localInputToIso(`${from}T00:00`)!)
    .lt("occurred_at", localInputToIso(`${nextDay(to)}T00:00`)!)
    .order("occurred_at")
    .order("id")
    .limit(5000);
  if (logError) throw logError;
  const ids = new Set((log ?? []).map((e) => e.id));
  const missing = [...new Set((log ?? []).map((e) => e.correction_of_id).filter((id): id is string => Boolean(id) && !ids.has(id!)))];
  const originals = missing.length
    ? ((
        await supabase
          .from("log_entries")
          .select("id, occurred_at, entry_type, description, result, created_by_name, performed_by_name, correction_of_id, correction_reason, electrical_installation_id, photos_url")
          .in("id", missing)
      ).data ?? [])
    : [];

  return {
    company: org.name,
    site: { name: site.name, address: site.address, responsiblePerson: site.responsible_person },
    installations: (installations.data ?? []).map((i) => ({ id: i.id, name: i.name, identifier: i.identifier })),
    period: { from, to },
    generatedAt: new Date().toISOString(),
    plan: (plan.data ?? []).map((a) => ({
      title: a.title,
      installationId: a.electrical_installation_id,
      nextDueOn: a.next_due_on,
      frequency: a.frequency_type,
      responsible: a.responsible_person_name,
    })),
    log: [...originals, ...(log ?? [])].map((e) => ({
      id: e.id,
      occurredAt: e.occurred_at,
      entryType: e.entry_type,
      description: e.description,
      result: e.result,
      createdByName: e.created_by_name,
      performedByName: e.performed_by_name,
      correctionOfId: e.correction_of_id,
      correctionReason: e.correction_reason,
      installationId: e.electrical_installation_id,
      photosUrl: e.photos_url,
    })),
    deficiencies: (deficiencies.data ?? []).map((x) => ({
      title: x.title,
      installationId: x.electrical_installation_id,
      severity: x.severity,
      status: x.status,
      detectedAt: x.detected_at,
      dueOn: x.due_on,
      resolution: x.resolution,
      resolvedAt: x.resolved_at,
      photosUrl: x.photos_url,
    })),
    documents: (documents.data ?? []).map((x) => ({ title: x.title, category: x.category, installationId: x.electrical_installation_id, url: x.external_url! })),
    audits: auditRows,
    nextAudits: (plan.data ?? [])
      .filter((a) => a.kind === "periodic_audit" && a.next_due_on)
      .map((a) => ({ installationId: a.electrical_installation_id, nextDueOn: a.next_due_on! })),
  };
}
