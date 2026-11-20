// Auditipakett — "Kokkuvõte audiitorile" (docs/AUDITS.md). Pure: builds the report from data
// that lib/data/audits.ts loaded through the user's own session (RLS). Six sections in the
// owner's order: cover, current plan, operating log of the period (each correction right
// after its original), deficiencies, documents and photo links, periodic audit. It makes no
// claim of matching any official form. Also loaded by node --test (relative imports).
import type { T } from "../i18n/index.ts";
import type { Report, Row } from "./types.ts";

export type AuditPackageData = {
  company: string;
  site: { name: string; address: string | null; responsiblePerson: string | null };
  installations: { id: string; name: string; identifier: string | null }[];
  period: { from: string; to: string };
  generatedAt: string;
  plan: { title: string; installationId: string; nextDueOn: string | null; frequency: "once" | "recurring"; responsible: string | null }[];
  log: {
    id: string;
    occurredAt: string;
    entryType: string;
    description: string;
    result: string | null;
    createdByName: string;
    performedByName: string | null;
    correctionOfId: string | null;
    correctionReason: string | null;
    installationId: string;
    photosUrl: string | null;
  }[];
  deficiencies: {
    title: string;
    installationId: string;
    severity: string;
    status: string;
    detectedAt: string;
    dueOn: string | null;
    resolution: string | null;
    resolvedAt: string | null;
    photosUrl: string | null;
  }[];
  documents: { title: string; category: string; installationId: string | null; url: string }[];
  audits: { installationId: string; auditedOn: string; result: string; auditor: string; documentUrl: string | null }[];
  nextAudits: { installationId: string; nextDueOn: string }[];
};

/** Originals in time order, each followed by its corrections (time order). */
export function orderWithCorrections<E extends { id: string; occurredAt: string; correctionOfId: string | null }>(entries: E[]): E[] {
  const byTime = [...entries].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  const corrections = new Map<string, E[]>();
  const ids = new Set(entries.map((e) => e.id));
  for (const e of byTime) {
    if (e.correctionOfId && ids.has(e.correctionOfId)) {
      corrections.set(e.correctionOfId, [...(corrections.get(e.correctionOfId) ?? []), e]);
    }
  }
  const out: E[] = [];
  const visit = (e: E) => {
    out.push(e);
    for (const c of corrections.get(e.id) ?? []) visit(c);
  };
  for (const e of byTime) if (!e.correctionOfId || !ids.has(e.correctionOfId)) visit(e);
  return out;
}

export function buildAuditPackage(d: AuditPackageData, t: T): Report {
  const p = t.app.auditPackage;
  const c = p.columns;
  const inst = new Map(d.installations.map((i) => [i.id, [i.identifier, i.name].filter(Boolean).join(" ")]));
  const name = (id: string | null) => (id ? (inst.get(id) ?? "") : "");
  const date = (v: string | null) => (v ? t.fmt.date(v) : "");
  const types = t.app.log.types as Record<string, string>;
  const severities = t.app.deficiencies.severities as Record<string, string>;
  const statuses = t.app.deficiencies.statuses as Record<string, string>;
  const categories = t.app.documents.categories as Record<string, string>;

  const logRows: Row[] = orderWithCorrections(d.log).map((e) => ({
    date: t.fmt.dateTime(e.occurredAt),
    installation: name(e.installationId),
    type: types[e.entryType] ?? e.entryType,
    description: [
      e.correctionOfId ? `↳ ${p.correction}${e.correctionReason ? `: ${e.correctionReason}` : ""}` : null,
      e.description,
      e.result,
      e.photosUrl ? `${p.photo}: ${e.photosUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    author: [e.createdByName, e.performedByName].filter(Boolean).join(" / "),
  }));

  const photoDocs = [
    ...d.log.filter((e) => e.photosUrl).map((e) => ({ title: `${p.photo}: ${e.description.slice(0, 80)}`, category: "", installationId: e.installationId, url: e.photosUrl! })),
    ...d.deficiencies.filter((x) => x.photosUrl).map((x) => ({ title: `${p.photo}: ${x.title}`, category: "", installationId: x.installationId, url: x.photosUrl! })),
  ];

  const latestAudit = new Map<string, AuditPackageData["audits"][number]>();
  for (const a of [...d.audits].sort((x, y) => x.auditedOn.localeCompare(y.auditedOn))) latestAudit.set(a.installationId, a);
  const nextAudit = new Map(d.nextAudits.map((n) => [n.installationId, n.nextDueOn]));

  return {
    kind: "audit",
    title: p.title,
    company: d.company,
    scope: d.site.name,
    fileScope: d.site.name,
    filters: [],
    generatedAt: d.generatedAt,
    truncated: false,
    orientation: "landscape",
    sections: [
      {
        kind: "facts",
        title: p.sections.cover,
        rows: [
          [p.cover.site, d.site.name],
          [p.cover.address, d.site.address ?? ""],
          [p.cover.installations, d.installations.map((i) => [i.identifier, i.name].filter(Boolean).join(" ")).join(", ")],
          [p.cover.manager, d.site.responsiblePerson ?? ""],
          [p.cover.company, d.company],
          [p.cover.periodStart, date(d.period.from)],
          [p.cover.periodEnd, date(d.period.to)],
          [p.cover.generatedOn, t.fmt.date(d.generatedAt)],
        ],
      },
      {
        kind: "table",
        title: p.sections.plan,
        columns: [
          { key: "activity", label: c.activity, width: 2.2 },
          { key: "installation", label: c.installation, width: 1.6 },
          { key: "due", label: c.due, width: 0.9 },
          { key: "frequency", label: c.frequency, width: 0.9 },
          { key: "responsible", label: c.responsible, width: 1.2 },
        ],
        rows: d.plan.map((a) => ({
          activity: a.title,
          installation: name(a.installationId),
          due: date(a.nextDueOn),
          frequency: a.frequency === "once" ? p.once : p.recurring,
          responsible: a.responsible ?? "",
        })),
        empty: t.reports.emptySection,
        total: d.plan.length,
      },
      {
        kind: "table",
        title: p.sections.log,
        columns: [
          { key: "date", label: c.date, width: 1 },
          { key: "installation", label: c.installation, width: 1.3 },
          { key: "type", label: c.type, width: 0.9 },
          { key: "description", label: c.description, width: 3.4 },
          { key: "author", label: c.author, width: 1.2 },
        ],
        rows: logRows,
        empty: t.reports.emptySection,
        total: logRows.length,
      },
      {
        kind: "table",
        title: p.sections.deficiencies,
        columns: [
          { key: "title", label: c.title, width: 2 },
          { key: "installation", label: c.installation, width: 1.3 },
          { key: "severity", label: c.severity, width: 0.8 },
          { key: "status", label: c.status, width: 0.8 },
          { key: "detected", label: c.detected, width: 0.8 },
          { key: "due", label: c.due, width: 0.8 },
          { key: "resolution", label: c.resolution, width: 2 },
        ],
        rows: d.deficiencies.map((x) => ({
          title: x.title,
          installation: name(x.installationId),
          severity: severities[x.severity] ?? x.severity,
          status: statuses[x.status] ?? x.status,
          detected: date(x.detectedAt),
          due: date(x.dueOn),
          resolution: [x.resolution, x.resolvedAt ? date(x.resolvedAt) : null].filter(Boolean).join(" · "),
        })),
        empty: t.reports.emptySection,
        total: d.deficiencies.length,
      },
      {
        kind: "table",
        title: p.sections.documents,
        columns: [
          { key: "document", label: c.document, width: 2 },
          { key: "category", label: c.category, width: 1 },
          { key: "installation", label: c.installation, width: 1.3 },
          { key: "link", label: c.link, width: 3 },
        ],
        rows: [...d.documents, ...photoDocs].map((x) => ({
          document: x.title,
          category: x.category ? (categories[x.category] ?? x.category) : p.photo,
          installation: name(x.installationId),
          link: x.url,
        })),
        empty: t.reports.emptySection,
        total: d.documents.length + photoDocs.length,
      },
      {
        kind: "table",
        title: p.sections.audit,
        columns: [
          { key: "installation", label: c.installation, width: 1.4 },
          { key: "audited", label: c.audited, width: 0.9 },
          { key: "result", label: c.result, width: 1.6 },
          { key: "auditor", label: c.auditor, width: 1.2 },
          { key: "link", label: c.link, width: 2 },
          { key: "next", label: c.next, width: 0.9 },
        ],
        rows: d.installations.map((i) => {
          const a = latestAudit.get(i.id);
          return {
            installation: name(i.id),
            audited: a ? date(a.auditedOn) : "",
            result: a?.result ?? "",
            auditor: a?.auditor ?? "",
            link: a?.documentUrl ?? "",
            next: date(nextAudit.get(i.id) ?? null),
          };
        }),
        empty: t.reports.emptySection,
        total: d.installations.length,
      },
    ],
  };
}

/** Default period start: the earliest of the installations' latest audits, else 12 months back. */
export function defaultPeriodStart(audits: { installationId: string; auditedOn: string }[], today: string): string {
  const latest = new Map<string, string>();
  for (const a of audits) if (!latest.has(a.installationId) || latest.get(a.installationId)! < a.auditedOn) latest.set(a.installationId, a.auditedOn);
  if (latest.size === 0) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }
  return [...latest.values()].sort()[0];
}
