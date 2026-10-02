import "server-only";
import type { OrgContext } from "@/lib/data/organisations";
import type { T } from "@/lib/i18n";
import { countdown, countdownText, dueStateRange } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { localInputToIso, todayInTallinn, toLocalInput } from "@/lib/time";
import type { ReportFilters } from "./filters";
import { type Column, MAX_EXPORT_ROWS, type Report, type ReportKind, type Row, type Section } from "./types";

// Report data is read with the user's own Supabase session: RLS decides every row, so a
// report never contains anything the user could not open in the app. Names of sites and
// installations are loaded once per report (no per-row queries); large tables are read in
// pages up to MAX_EXPORT_ROWS.

type Client = Awaited<ReturnType<typeof createClient>>;
type Place = { site: string; name: string; identifier: string | null; siteId: string };

const PAGE = 1000;

/** Reads a filtered query page by page (deterministic order), up to the export cap. */
async function readAll<R>(build: (from: number, to: number) => PromiseLike<{ data: R[] | null; error: unknown }>, cap = MAX_EXPORT_ROWS) {
  const out: R[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await build(from, Math.min(from + PAGE, cap) - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function places(supabase: Client, orgId: string) {
  const [sites, installations] = await Promise.all([
    supabase.from("sites").select("id, name").eq("organisation_id", orgId),
    supabase.from("electrical_installations").select("id, name, identifier, site_id").eq("organisation_id", orgId),
  ]);
  if (sites.error) throw sites.error;
  if (installations.error) throw installations.error;
  const siteName = new Map(sites.data.map((s) => [s.id, s.name]));
  const inst = new Map<string, Place>(
    installations.data.map((i) => [i.id, { site: siteName.get(i.site_id) ?? "", name: i.name, identifier: i.identifier, siteId: i.site_id }]),
  );
  return { siteName, inst };
}

const label = (p: Place | undefined) => (p ? [p.identifier, p.name].filter(Boolean).join(" ") : "");
/** Tallinn day bounds as UTC instants. */
const dayStart = (day: string) => localInputToIso(`${day}T00:00`)!;
const nextDayStart = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return dayStart(d.toISOString().slice(0, 10));
};
/** Raw, sortable local time for CSV. */
const csvTime = (iso: string | null) => (iso ? toLocalInput(new Date(iso)).replace("T", " ") : "");

function frequency(t: T, a: { frequency_type: string; interval_value: number | null; interval_unit: string | null }) {
  const f = t.app.schedule.frequency;
  return a.frequency_type === "recurring" && a.interval_value && a.interval_unit
    ? f.every(a.interval_value, a.interval_unit as "day" | "week" | "month" | "year")
    : f.once;
}

function scopeOf(f: ReportFilters, p: Awaited<ReturnType<typeof places>>, company: string) {
  if (f.installation && p.inst.get(f.installation)) {
    const i = p.inst.get(f.installation)!;
    return { scope: `${i.site} · ${label(i)}`, fileScope: label(i) || i.site };
  }
  if (f.site && p.siteName.get(f.site)) return { scope: p.siteName.get(f.site)!, fileScope: p.siteName.get(f.site)! };
  return { scope: company, fileScope: "" };
}

function filterFacts(t: T, f: ReportFilters, p: Awaited<ReturnType<typeof places>>, extra: [string, string | undefined][] = []) {
  const r = t.reports.filters;
  const out: [string, string][] = [];
  if (f.site) out.push([r.site, p.siteName.get(f.site) ?? "—"]);
  if (f.installation) out.push([r.installation, label(p.inst.get(f.installation)) || "—"]);
  out.push([t.reports.period, f.from || f.to ? `${f.from ? t.fmt.date(f.from) : "…"} – ${f.to ? t.fmt.date(f.to) : "…"}` : t.reports.allTime]);
  for (const [k, v] of extra) if (v) out.push([k, v]);
  return out;
}

function base(kind: ReportKind, t: T, ctx: OrgContext, orientation: Report["orientation"]): Omit<Report, "scope" | "filters" | "sections" | "truncated" | "fileScope"> {
  return { kind, title: t.reports.types[kind].title, company: ctx.org.name, generatedAt: new Date().toISOString(), orientation };
}

// ---------------------------------------------------------------------------
// Käidupäevik
// ---------------------------------------------------------------------------

async function logReport(ctx: OrgContext, t: T, f: ReportFilters, cap: number): Promise<Report> {
  const supabase = await createClient();
  const org = ctx.org.id;
  const p = await places(supabase, org);
  const c = t.reports.columns;
  const filtered = () => {
    let q = supabase
      .from("log_entries")
      .select(
        "id, occurred_at, entry_type, description, result, performed_by_name, created_by_name, correction_of_id, correction_reason, electrical_installation_id",
        { count: "exact" },
      )
      .eq("organisation_id", org);
    if (f.site) q = q.eq("site_id", f.site);
    if (f.installation) q = q.eq("electrical_installation_id", f.installation);
    if (f.type) q = q.eq("entry_type", f.type);
    if (f.from) q = q.gte("occurred_at", dayStart(f.from));
    if (f.to) q = q.lt("occurred_at", nextDayStart(f.to));
    return q.order("occurred_at", { ascending: true }).order("id", { ascending: true });
  };
  const { count } = await filtered().range(0, 0);
  const rows = await readAll((a, b) => filtered().range(a, b), cap);

  // Corrections are shown as such: each correction names the entry it corrects; corrected
  // originals say how often. History is never merged into a "clean" version.
  const [corrections, attachments] = await Promise.all([
    readAll((a, b) =>
      supabase.from("log_entries").select("correction_of_id").eq("organisation_id", org).not("correction_of_id", "is", null).order("id").range(a, b),
    ),
    readAll((a, b) =>
      supabase.from("documents").select("log_entry_id").eq("organisation_id", org).eq("status", "ready").not("log_entry_id", "is", null).order("id").range(a, b),
    ),
  ]);
  const correctedCount = new Map<string, number>();
  for (const r of corrections) correctedCount.set(r.correction_of_id!, (correctedCount.get(r.correction_of_id!) ?? 0) + 1);
  const attachmentCount = new Map<string, number>();
  for (const r of attachments) attachmentCount.set(r.log_entry_id!, (attachmentCount.get(r.log_entry_id!) ?? 0) + 1);
  const originals = new Map(rows.map((r) => [r.id, r.occurred_at]));
  const missing = [...new Set(rows.map((r) => r.correction_of_id).filter((id): id is string => !!id && !originals.has(id)))];
  for (let i = 0; i < missing.length; i += 100) {
    const { data, error } = await supabase.from("log_entries").select("id, occurred_at").in("id", missing.slice(i, i + 100));
    if (error) throw error;
    for (const r of data) originals.set(r.id, r.occurred_at);
  }

  const columns: Column[] = [
    { key: "date", label: c.date, width: 1.1 },
    { key: "type", label: c.type, width: 0.9 },
    { key: "installation", label: c.installation, width: 1.4 },
    { key: "description", label: c.description, width: 3.2 },
    { key: "people", label: `${c.performedBy} / ${c.recordedBy}`, width: 1.3 },
    { key: "correction", label: c.correction, width: 1.4 },
    { key: "attachments", label: c.attachments, width: 0.6 },
  ];
  const display: Row[] = [];
  const csv: Row[] = [];
  for (const r of rows) {
    const place = p.inst.get(r.electrical_installation_id);
    const corrected = correctedCount.get(r.id) ?? 0;
    const original = r.correction_of_id ? originals.get(r.correction_of_id) : null;
    const correctionText = r.correction_of_id
      ? `${t.reports.correctionOf(original ? t.fmt.dateTime(original) : "—")}${r.correction_reason ? `. ${t.reports.reason}: ${r.correction_reason}` : ""}`
      : corrected
        ? t.reports.corrected(corrected)
        : "";
    display.push({
      date: t.fmt.dateTime(r.occurred_at),
      type: t.app.log.types[r.entry_type],
      installation: [place?.site, label(place)].filter(Boolean).join(" · "),
      description: r.result ? `${r.description}\n${c.result}: ${r.result}` : r.description,
      people: [r.performed_by_name, r.created_by_name].filter(Boolean).join(" / "),
      correction: correctionText,
      attachments: String(attachmentCount.get(r.id) ?? 0),
    });
    csv.push({
      date: csvTime(r.occurred_at),
      type: t.app.log.types[r.entry_type],
      site: place?.site ?? "",
      identifier: place?.identifier ?? "",
      installation: place?.name ?? "",
      description: r.description,
      result: r.result ?? "",
      performedBy: r.performed_by_name ?? "",
      recordedBy: r.created_by_name ?? "",
      correctionOf: original ? csvTime(original) : "",
      reason: r.correction_reason ?? "",
      corrections: String(corrected),
      attachments: String(attachmentCount.get(r.id) ?? 0),
    });
  }
  const total = count ?? rows.length;
  return {
    ...base("log", t, ctx, "landscape"),
    ...scopeOf(f, p, ctx.org.name),
    filters: filterFacts(t, f, p, [[c.type, f.type ? t.app.log.types[f.type] : undefined]]),
    sections: [{ kind: "table", title: t.reports.types.log.title, columns, rows: display, empty: t.reports.empty, total }],
    csv: {
      columns: [
        { key: "date", label: c.date },
        { key: "type", label: c.type },
        { key: "site", label: c.site },
        { key: "identifier", label: c.identifier },
        { key: "installation", label: c.installation },
        { key: "description", label: c.description },
        { key: "result", label: c.result },
        { key: "performedBy", label: c.performedBy },
        { key: "recordedBy", label: c.recordedBy },
        { key: "correctionOf", label: t.reports.correctionOf("…") },
        { key: "reason", label: t.reports.reason },
        { key: "corrections", label: c.correction },
        { key: "attachments", label: c.attachments },
      ],
      rows: csv,
    },
    truncated: total > rows.length,
  };
}

// ---------------------------------------------------------------------------
// Käidukava
// ---------------------------------------------------------------------------

async function lastCompletions(supabase: Client, org: string) {
  const rows = await readAll(
    (a, b) =>
      supabase
        .from("log_entries")
        .select("scheduled_activity_id, occurred_at")
        .eq("organisation_id", org)
        .not("scheduled_activity_id", "is", null)
        .order("occurred_at", { ascending: false })
        .order("id")
        .range(a, b),
    20_000,
  );
  const latest = new Map<string, string>();
  for (const r of rows) if (!latest.has(r.scheduled_activity_id!)) latest.set(r.scheduled_activity_id!, r.occurred_at);
  return latest;
}

async function planReport(ctx: OrgContext, t: T, f: ReportFilters, cap: number): Promise<Report> {
  const supabase = await createClient();
  const org = ctx.org.id;
  const today = todayInTallinn();
  const [p, latest] = await Promise.all([places(supabase, org), lastCompletions(supabase, org)]);
  const c = t.reports.columns;
  const filtered = () => {
    let q = supabase
      .from("scheduled_activities")
      .select("id, title, frequency_type, interval_value, interval_unit, next_due_on, responsible_person_name, reminder_days, archived_at, electrical_installation_id", {
        count: "exact",
      })
      .eq("organisation_id", org);
    if (!f.archived) q = q.is("archived_at", null);
    if (f.site) q = q.eq("site_id", f.site);
    if (f.installation) q = q.eq("electrical_installation_id", f.installation);
    if (f.due) {
      const r = dueStateRange(f.due, today);
      if ("before" in r) q = q.lt("next_due_on", r.before);
      if ("from" in r && r.from) q = q.gte("next_due_on", r.from);
      if ("to" in r && r.to) q = q.lte("next_due_on", r.to);
      if ("after" in r) q = q.gt("next_due_on", r.after);
    }
    if (f.from) q = q.gte("next_due_on", f.from);
    if (f.to) q = q.lte("next_due_on", f.to);
    return q.order("next_due_on", { ascending: true, nullsFirst: false }).order("id");
  };
  const { count } = await filtered().range(0, 0);
  const rows = await readAll((a, b) => filtered().range(a, b), cap);
  const columns: Column[] = [
    { key: "activity", label: c.activity, width: 2.2 },
    { key: "installation", label: c.installation, width: 1.6 },
    { key: "recurrence", label: c.recurrence, width: 1.1 },
    { key: "nextDue", label: c.nextDue, width: 0.9 },
    { key: "countdown", label: c.countdown, width: 1.1 },
    { key: "responsible", label: c.responsible, width: 1.1 },
    { key: "lastDone", label: c.lastDone, width: 1 },
    { key: "reminders", label: c.reminders, width: 1.2 },
  ];
  const display: Row[] = [];
  const csv: Row[] = [];
  for (const a of rows) {
    const place = p.inst.get(a.electrical_installation_id);
    const cd = countdown(a.next_due_on, today);
    const status = a.archived_at ? t.reports.archived : cd ? countdownText(cd, t.countdown) : t.app.schedule.states.done;
    const reminders = a.reminder_days.length ? t.app.schedule.reminders.summary(a.reminder_days) : t.app.schedule.reminders.none;
    const last = latest.get(a.id) ?? null;
    display.push({
      activity: a.title,
      installation: [place?.site, label(place)].filter(Boolean).join(" · "),
      recurrence: frequency(t, a),
      nextDue: a.next_due_on ? t.fmt.date(a.next_due_on) : "—",
      countdown: status,
      responsible: a.responsible_person_name ?? "",
      lastDone: last ? t.fmt.date(last) : "—",
      reminders,
    });
    csv.push({
      activity: a.title,
      site: place?.site ?? "",
      identifier: place?.identifier ?? "",
      installation: place?.name ?? "",
      recurrence: frequency(t, a),
      nextDue: a.next_due_on ?? "",
      days: cd ? String(cd.days) : "",
      countdown: status,
      responsible: a.responsible_person_name ?? "",
      lastDone: csvTime(last),
      reminders: a.reminder_days.join(" "),
    });
  }
  const total = count ?? rows.length;
  return {
    ...base("plan", t, ctx, "landscape"),
    ...scopeOf(f, p, ctx.org.name),
    filters: filterFacts(t, f, p, [[t.reports.filters.due, f.due ? t.reports.dueStates[f.due] : undefined]]),
    sections: [{ kind: "table", title: t.reports.types.plan.title, columns, rows: display, empty: t.reports.empty, total }],
    csv: {
      columns: [
        { key: "activity", label: c.activity },
        { key: "site", label: c.site },
        { key: "identifier", label: c.identifier },
        { key: "installation", label: c.installation },
        { key: "recurrence", label: c.recurrence },
        { key: "nextDue", label: c.nextDue },
        { key: "days", label: `${c.countdown} (+/−)` },
        { key: "countdown", label: c.countdown },
        { key: "responsible", label: c.responsible },
        { key: "lastDone", label: c.lastDone },
        { key: "reminders", label: c.reminders },
      ],
      rows: csv,
    },
    truncated: total > rows.length,
  };
}

// ---------------------------------------------------------------------------
// Puudused
// ---------------------------------------------------------------------------

async function deficiencyReport(ctx: OrgContext, t: T, f: ReportFilters, cap: number): Promise<Report> {
  const supabase = await createClient();
  const org = ctx.org.id;
  const p = await places(supabase, org);
  const c = t.reports.columns;
  const d = t.app.deficiencies;
  const filtered = () => {
    let q = supabase
      .from("deficiencies")
      .select("id, title, description, severity, status, detected_at, responsible_person_name, due_on, resolved_at, resolution, resolved_by_name, electrical_installation_id", {
        count: "exact",
      })
      .eq("organisation_id", org);
    if (f.site) q = q.eq("site_id", f.site);
    if (f.installation) q = q.eq("electrical_installation_id", f.installation);
    if (f.status) q = q.eq("status", f.status);
    if (f.severity) q = q.eq("severity", f.severity);
    if (f.from) q = q.gte("detected_at", dayStart(f.from));
    if (f.to) q = q.lt("detected_at", nextDayStart(f.to));
    return q.order("detected_at", { ascending: false }).order("id");
  };
  const { count } = await filtered().range(0, 0);
  const rows = await readAll((a, b) => filtered().range(a, b), cap);
  const columns: Column[] = [
    { key: "title", label: c.title, width: 1.8 },
    { key: "installation", label: c.installation, width: 1.5 },
    { key: "severity", label: c.severity, width: 0.8 },
    { key: "status", label: c.status, width: 0.8 },
    { key: "detected", label: c.detected, width: 0.9 },
    { key: "description", label: c.description, width: 2.2 },
    { key: "responsible", label: c.responsible, width: 1 },
    { key: "resolved", label: c.resolution, width: 2 },
  ];
  const display: Row[] = [];
  const csv: Row[] = [];
  for (const r of rows) {
    const place = p.inst.get(r.electrical_installation_id);
    const resolved = r.resolved_at ? `${t.fmt.date(r.resolved_at)}${r.resolved_by_name ? ` · ${r.resolved_by_name}` : ""}${r.resolution ? `\n${r.resolution}` : ""}` : "";
    display.push({
      title: r.title,
      installation: [place?.site, label(place)].filter(Boolean).join(" · "),
      severity: d.severities[r.severity],
      status: d.statuses[r.status],
      detected: t.fmt.date(r.detected_at),
      description: r.description,
      responsible: [r.responsible_person_name, r.due_on ? `${c.dueOn} ${t.fmt.date(r.due_on)}` : null].filter(Boolean).join("\n"),
      resolved,
    });
    csv.push({
      title: r.title,
      site: place?.site ?? "",
      identifier: place?.identifier ?? "",
      installation: place?.name ?? "",
      severity: d.severities[r.severity],
      status: d.statuses[r.status],
      detected: csvTime(r.detected_at),
      description: r.description,
      responsible: r.responsible_person_name ?? "",
      dueOn: r.due_on ?? "",
      resolvedAt: csvTime(r.resolved_at),
      resolvedBy: r.resolved_by_name ?? "",
      resolution: r.resolution ?? "",
    });
  }
  const total = count ?? rows.length;
  return {
    ...base("deficiencies", t, ctx, "landscape"),
    ...scopeOf(f, p, ctx.org.name),
    filters: filterFacts(t, f, p, [
      [t.reports.filters.status, f.status ? d.statuses[f.status] : undefined],
      [t.reports.filters.severity, f.severity ? d.severities[f.severity] : undefined],
    ]),
    sections: [{ kind: "table", title: t.reports.types.deficiencies.title, columns, rows: display, empty: t.reports.empty, total }],
    csv: {
      columns: [
        { key: "title", label: c.title },
        { key: "site", label: c.site },
        { key: "identifier", label: c.identifier },
        { key: "installation", label: c.installation },
        { key: "severity", label: c.severity },
        { key: "status", label: c.status },
        { key: "detected", label: c.detected },
        { key: "description", label: c.description },
        { key: "responsible", label: c.responsible },
        { key: "dueOn", label: c.dueOn },
        { key: "resolvedAt", label: c.resolved },
        { key: "resolvedBy", label: `${c.resolved} (${t.reports.columns.performedBy})` },
        { key: "resolution", label: c.resolution },
      ],
      rows: csv,
    },
    truncated: total > rows.length,
  };
}

// ---------------------------------------------------------------------------
// Dokumendiregister
// ---------------------------------------------------------------------------

async function documentReport(ctx: OrgContext, t: T, f: ReportFilters, cap: number): Promise<Report> {
  const supabase = await createClient();
  const org = ctx.org.id;
  const p = await places(supabase, org);
  const c = t.reports.columns;
  const cats = t.app.documents.categories as Record<string, string>;
  const filtered = () => {
    let q = supabase
      .from("documents")
      .select("id, title, original_filename, category, site_id, electrical_installation_id, ready_at, uploaded_by_name, archived_at, log_entry_id, deficiency_id", {
        count: "exact",
      })
      .eq("organisation_id", org)
      .eq("status", "ready");
    if (!f.archived) q = q.is("archived_at", null);
    if (f.site) q = q.eq("site_id", f.site);
    if (f.installation) q = q.eq("electrical_installation_id", f.installation);
    if (f.category) q = q.eq("category", f.category as never);
    if (f.from) q = q.gte("ready_at", dayStart(f.from));
    if (f.to) q = q.lt("ready_at", nextDayStart(f.to));
    return q.order("ready_at", { ascending: false }).order("id");
  };
  const { count } = await filtered().range(0, 0);
  const rows = await readAll((a, b) => filtered().range(a, b), cap);
  const columns: Column[] = [
    { key: "title", label: c.title, width: 2 },
    { key: "filename", label: c.filename, width: 1.7 },
    { key: "category", label: c.category, width: 1 },
    { key: "where", label: `${c.site} / ${c.installation}`, width: 1.8 },
    { key: "uploaded", label: c.uploaded, width: 0.9 },
    { key: "uploadedBy", label: c.uploadedBy, width: 1 },
    { key: "state", label: c.state, width: 0.8 },
  ];
  const display: Row[] = [];
  const csv: Row[] = [];
  for (const r of rows) {
    const place = r.electrical_installation_id ? p.inst.get(r.electrical_installation_id) : undefined;
    const site = place?.site ?? (r.site_id ? p.siteName.get(r.site_id) : undefined) ?? "";
    const attachedTo = r.log_entry_id ? t.app.nav.log : r.deficiency_id ? t.app.nav.deficiencies : null;
    display.push({
      title: r.title,
      filename: r.original_filename,
      category: cats[r.category] ?? r.category,
      where: [site || ctx.org.name, label(place), attachedTo].filter(Boolean).join(" · "),
      uploaded: r.ready_at ? t.fmt.date(r.ready_at) : "",
      uploadedBy: r.uploaded_by_name ?? "",
      state: r.archived_at ? t.reports.archived : t.reports.active,
    });
    csv.push({
      title: r.title,
      filename: r.original_filename,
      category: cats[r.category] ?? r.category,
      site,
      identifier: place?.identifier ?? "",
      installation: place?.name ?? "",
      attachedTo: attachedTo ?? "",
      uploaded: csvTime(r.ready_at),
      uploadedBy: r.uploaded_by_name ?? "",
      state: r.archived_at ? t.reports.archived : t.reports.active,
    });
  }
  const total = count ?? rows.length;
  return {
    ...base("documents", t, ctx, "landscape"),
    ...scopeOf(f, p, ctx.org.name),
    filters: filterFacts(t, f, p, [[t.reports.filters.category, f.category ? (cats[f.category] ?? f.category) : undefined]]),
    sections: [{ kind: "table", title: t.reports.types.documents.title, columns, rows: display, empty: t.reports.empty, total }],
    csv: {
      columns: [
        { key: "title", label: c.title },
        { key: "filename", label: c.filename },
        { key: "category", label: c.category },
        { key: "site", label: c.site },
        { key: "identifier", label: c.identifier },
        { key: "installation", label: c.installation },
        { key: "attachedTo", label: c.type },
        { key: "uploaded", label: c.uploaded },
        { key: "uploadedBy", label: c.uploadedBy },
        { key: "state", label: c.state },
      ],
      rows: csv,
    },
    truncated: total > rows.length,
  };
}

// ---------------------------------------------------------------------------
// Summaries (site, installation): small, bounded sections
// ---------------------------------------------------------------------------

type ActivityRow = { id: string; title: string; next_due_on: string | null; electrical_installation_id: string; responsible_person_name: string | null };

function activityTable(t: T, title: string, rows: ActivityRow[], today: string, inst: Map<string, Place>, withInstallation: boolean): Section {
  const c = t.reports.columns;
  const columns: Column[] = [
    { key: "activity", label: c.activity, width: 2.2 },
    ...(withInstallation ? [{ key: "installation", label: c.installation, width: 1.6 }] : []),
    { key: "nextDue", label: c.nextDue, width: 1 },
    { key: "countdown", label: c.countdown, width: 1.2 },
    { key: "responsible", label: c.responsible, width: 1.2 },
  ];
  return {
    kind: "table",
    title,
    columns,
    total: rows.length,
    empty: t.reports.empty,
    rows: rows.map((a) => {
      const cd = countdown(a.next_due_on, today);
      return {
        activity: a.title,
        installation: label(inst.get(a.electrical_installation_id)),
        nextDue: a.next_due_on ? t.fmt.date(a.next_due_on) : "—",
        countdown: cd ? countdownText(cd, t.countdown) : "",
        responsible: a.responsible_person_name ?? "",
      };
    }),
  };
}

type DeficiencyRow = { title: string; severity: "low" | "medium" | "high" | "critical"; status: "open" | "in_progress" | "resolved"; detected_at: string; electrical_installation_id: string; responsible_person_name: string | null };

function deficiencyTable(t: T, rows: DeficiencyRow[], inst: Map<string, Place>, withInstallation: boolean): Section {
  const c = t.reports.columns;
  const d = t.app.deficiencies;
  return {
    kind: "table",
    title: t.reports.sections.openDeficiencies,
    total: rows.length,
    empty: t.reports.empty,
    columns: [
      { key: "title", label: c.title, width: 2.2 },
      ...(withInstallation ? [{ key: "installation", label: c.installation, width: 1.6 }] : []),
      { key: "severity", label: c.severity, width: 0.9 },
      { key: "status", label: c.status, width: 0.9 },
      { key: "detected", label: c.detected, width: 1 },
      { key: "responsible", label: c.responsible, width: 1.2 },
    ],
    rows: rows.map((r) => ({
      title: r.title,
      installation: label(inst.get(r.electrical_installation_id)),
      severity: d.severities[r.severity],
      status: d.statuses[r.status],
      detected: t.fmt.date(r.detected_at),
      responsible: r.responsible_person_name ?? "",
    })),
  };
}

type LogRow = { occurred_at: string; entry_type: keyof T["app"]["log"]["types"]; description: string; created_by_name: string | null; correction_of_id: string | null; electrical_installation_id: string };

function logTable(t: T, rows: LogRow[], inst: Map<string, Place>, withInstallation: boolean): Section {
  const c = t.reports.columns;
  return {
    kind: "table",
    title: t.reports.sections.recentLog,
    total: rows.length,
    empty: t.reports.empty,
    columns: [
      { key: "date", label: c.date, width: 1.1 },
      { key: "type", label: c.type, width: 0.9 },
      ...(withInstallation ? [{ key: "installation", label: c.installation, width: 1.4 }] : []),
      { key: "description", label: c.description, width: 3 },
      { key: "recordedBy", label: c.recordedBy, width: 1.1 },
    ],
    rows: rows.map((r) => ({
      date: t.fmt.dateTime(r.occurred_at),
      type: t.app.log.types[r.entry_type] + (r.correction_of_id ? ` (${t.search.correction})` : ""),
      installation: label(inst.get(r.electrical_installation_id)),
      description: r.description,
      recordedBy: r.created_by_name ?? "",
    })),
  };
}

async function siteReport(ctx: OrgContext, t: T, f: ReportFilters): Promise<Report | null> {
  if (!f.site) return null;
  const supabase = await createClient();
  const org = ctx.org.id;
  const today = todayInTallinn();
  const soon = dueStateRange("soon", today) as { from: string; to: string };
  const { data: site } = await supabase.from("sites").select("id, name, address, responsible_person").eq("organisation_id", org).eq("id", f.site).maybeSingle();
  if (!site) return null;
  const [p, installations, overdue, dueSoon, deficiencies, log, docs] = await Promise.all([
    places(supabase, org),
    supabase.from("electrical_installations").select("id, name, identifier, installation_type, status").eq("organisation_id", org).eq("site_id", site.id).is("archived_at", null).order("name"),
    supabase.from("scheduled_activities").select("id, title, next_due_on, electrical_installation_id, responsible_person_name").eq("organisation_id", org).eq("site_id", site.id).is("archived_at", null).lt("next_due_on", today).order("next_due_on"),
    supabase.from("scheduled_activities").select("id, title, next_due_on, electrical_installation_id, responsible_person_name").eq("organisation_id", org).eq("site_id", site.id).is("archived_at", null).gte("next_due_on", soon.from).lte("next_due_on", soon.to).order("next_due_on"),
    supabase.from("deficiencies").select("title, severity, status, detected_at, electrical_installation_id, responsible_person_name").eq("organisation_id", org).eq("site_id", site.id).neq("status", "resolved").order("detected_at", { ascending: false }),
    supabase.from("log_entries").select("occurred_at, entry_type, description, created_by_name, correction_of_id, electrical_installation_id").eq("organisation_id", org).eq("site_id", site.id).order("occurred_at", { ascending: false }).limit(10),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("organisation_id", org).eq("site_id", site.id).eq("status", "ready").is("archived_at", null),
  ]);
  for (const r of [installations, overdue, dueSoon, deficiencies, log]) if (r.error) throw r.error;
  const c = t.reports.columns;
  const fa = t.reports.facts;
  const openByInst = new Map<string, number>();
  for (const d of deficiencies.data ?? []) openByInst.set(d.electrical_installation_id, (openByInst.get(d.electrical_installation_id) ?? 0) + 1);
  const overdueByInst = new Map<string, number>();
  for (const a of overdue.data ?? []) overdueByInst.set(a.electrical_installation_id, (overdueByInst.get(a.electrical_installation_id) ?? 0) + 1);
  return {
    ...base("site", t, ctx, "portrait"),
    scope: site.name,
    fileScope: site.name,
    filters: [],
    truncated: false,
    sections: [
      {
        kind: "facts",
        title: t.reports.sections.details,
        rows: [
          [fa.company, ctx.org.name],
          [fa.site, site.name],
          ...(site.address ? ([[fa.address, site.address]] as [string, string][]) : []),
          ...(site.responsible_person ? ([[fa.responsible, site.responsible_person]] as [string, string][]) : []),
          [fa.installationCount, String(installations.data?.length ?? 0)],
          [fa.documentCount, String(docs.count ?? 0)],
        ],
      },
      {
        kind: "table",
        title: t.reports.sections.installations,
        total: installations.data?.length ?? 0,
        empty: t.reports.empty,
        columns: [
          { key: "identifier", label: c.identifier, width: 0.9 },
          { key: "name", label: c.name, width: 2 },
          { key: "type", label: fa.type, width: 1.4 },
          { key: "status", label: fa.status, width: 1 },
          { key: "overdue", label: c.overdue, width: 0.8 },
          { key: "open", label: c.openDeficiencies, width: 0.9 },
        ],
        rows: (installations.data ?? []).map((i) => ({
          identifier: i.identifier ?? "",
          name: i.name,
          type: t.app.installations.types[i.installation_type as keyof T["app"]["installations"]["types"]] ?? "",
          status: t.app.installations.statuses[i.status as keyof T["app"]["installations"]["statuses"]] ?? "",
          overdue: String(overdueByInst.get(i.id) ?? 0),
          open: String(openByInst.get(i.id) ?? 0),
        })),
      },
      activityTable(t, t.reports.sections.overdue, overdue.data ?? [], today, p.inst, true),
      activityTable(t, t.reports.sections.dueSoon, dueSoon.data ?? [], today, p.inst, true),
      deficiencyTable(t, deficiencies.data ?? [], p.inst, true),
      logTable(t, (log.data ?? []) as LogRow[], p.inst, true),
    ],
  };
}

async function installationReport(ctx: OrgContext, t: T, f: ReportFilters): Promise<Report | null> {
  if (!f.installation) return null;
  const supabase = await createClient();
  const org = ctx.org.id;
  const today = todayInTallinn();
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 90);
  const { data: inst } = await supabase
    .from("electrical_installations")
    .select("id, name, identifier, installation_type, status, location, responsible_person, site_id")
    .eq("organisation_id", org)
    .eq("id", f.installation)
    .maybeSingle();
  if (!inst) return null;
  const [p, overdue, upcoming, deficiencies, log, docs] = await Promise.all([
    places(supabase, org),
    supabase.from("scheduled_activities").select("id, title, next_due_on, electrical_installation_id, responsible_person_name").eq("organisation_id", org).eq("electrical_installation_id", inst.id).is("archived_at", null).lt("next_due_on", today).order("next_due_on"),
    supabase.from("scheduled_activities").select("id, title, next_due_on, electrical_installation_id, responsible_person_name").eq("organisation_id", org).eq("electrical_installation_id", inst.id).is("archived_at", null).gte("next_due_on", today).lte("next_due_on", horizon.toISOString().slice(0, 10)).order("next_due_on"),
    supabase.from("deficiencies").select("title, severity, status, detected_at, electrical_installation_id, responsible_person_name").eq("organisation_id", org).eq("electrical_installation_id", inst.id).neq("status", "resolved").order("detected_at", { ascending: false }),
    supabase.from("log_entries").select("occurred_at, entry_type, description, created_by_name, correction_of_id, electrical_installation_id").eq("organisation_id", org).eq("electrical_installation_id", inst.id).order("occurred_at", { ascending: false }).limit(10),
    supabase.from("documents").select("title, category, ready_at", { count: "exact" }).eq("organisation_id", org).eq("electrical_installation_id", inst.id).eq("status", "ready").is("archived_at", null).order("ready_at", { ascending: false }).limit(20),
  ]);
  for (const r of [overdue, upcoming, deficiencies, log, docs]) if (r.error) throw r.error;
  const fa = t.reports.facts;
  const c = t.reports.columns;
  const cats = t.app.documents.categories as Record<string, string>;
  const siteName = p.siteName.get(inst.site_id) ?? "";
  const optional = (k: string, v: string | null): [string, string][] => (v ? [[k, v]] : []);
  return {
    ...base("installation", t, ctx, "portrait"),
    scope: `${siteName} · ${label({ site: siteName, name: inst.name, identifier: inst.identifier, siteId: inst.site_id })}`,
    fileScope: [inst.identifier, inst.name].filter(Boolean).join(" "),
    filters: [],
    truncated: false,
    sections: [
      {
        kind: "facts",
        title: t.reports.sections.details,
        rows: [
          [fa.company, ctx.org.name],
          [fa.site, siteName],
          [fa.installation, inst.name],
          ...optional(fa.identifier, inst.identifier),
          [fa.type, t.app.installations.types[inst.installation_type as keyof T["app"]["installations"]["types"]] ?? ""],
          [fa.status, t.app.installations.statuses[inst.status as keyof T["app"]["installations"]["statuses"]] ?? ""],
          ...optional(fa.location, inst.location),
          ...optional(fa.responsible, inst.responsible_person),
          [fa.documentCount, String(docs.count ?? 0)],
        ],
      },
      logTable(t, (log.data ?? []) as LogRow[], p.inst, false),
      activityTable(t, t.reports.sections.overdue, overdue.data ?? [], today, p.inst, false),
      activityTable(t, t.reports.sections.upcoming, upcoming.data ?? [], today, p.inst, false),
      deficiencyTable(t, deficiencies.data ?? [], p.inst, false),
      {
        kind: "table",
        title: t.reports.sections.documents,
        total: docs.count ?? 0,
        empty: t.reports.empty,
        columns: [
          { key: "title", label: c.title, width: 2.5 },
          { key: "category", label: c.category, width: 1.2 },
          { key: "uploaded", label: c.uploaded, width: 1 },
        ],
        rows: (docs.data ?? []).map((d) => ({ title: d.title, category: cats[d.category] ?? d.category, uploaded: d.ready_at ? t.fmt.date(d.ready_at) : "" })),
      },
    ],
  };
}

/** Builds a report; null when a summary's required site/installation is missing or not readable. */
export async function buildReport(kind: ReportKind, ctx: OrgContext, t: T, f: ReportFilters, cap = MAX_EXPORT_ROWS): Promise<Report | null> {
  switch (kind) {
    case "log":
      return logReport(ctx, t, f, cap);
    case "plan":
      return planReport(ctx, t, f, cap);
    case "deficiencies":
      return deficiencyReport(ctx, t, f, cap);
    case "documents":
      return documentReport(ctx, t, f, cap);
    case "site":
      return siteReport(ctx, t, f);
    case "installation":
      return installationReport(ctx, t, f);
  }
}
