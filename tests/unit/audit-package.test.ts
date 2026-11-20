import { test } from "node:test";
import assert from "node:assert/strict";
import type { T } from "../../lib/i18n/index.ts";
import { en } from "../../lib/i18n/en.ts";
import { et } from "../../lib/i18n/et.ts";
import { ru } from "../../lib/i18n/ru.ts";
import { buildAuditPackage, defaultPeriodStart, orderWithCorrections, type AuditPackageData } from "../../lib/reports/audit-package.ts";
import { renderPdf, reportDocument } from "../../lib/reports/pdf-document.ts";

// Formatting as in the app (Tallinn time); the real makeFormat uses a path alias.
const tFor = (messages: typeof et, locale: "et" | "en" | "ru"): T => {
  const tag = { et: "et-EE", en: "en-GB", ru: "ru-RU" }[locale];
  const date = new Intl.DateTimeFormat(tag, { timeZone: "Europe/Tallinn", day: "2-digit", month: "2-digit", year: "numeric" });
  const dt = new Intl.DateTimeFormat(tag, { timeZone: "Europe/Tallinn", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return {
    ...messages,
    locale,
    fmt: { date: (v: string | Date) => date.format(new Date(v)), dateTime: (v: string | Date) => dt.format(new Date(v)), time: String, number: String, bytes: String },
  } as unknown as T;
};

const sample: AuditPackageData = {
  company: "Näidis Elekter OÜ",
  site: { name: "Mustamäe tee 5", address: "Mustamäe tee 5, Tallinn", responsiblePerson: "Mari Käidukorraldaja" },
  installations: [
    { id: "i1", name: "Peajaotuskilp", identifier: "PJK-1" },
    { id: "i2", name: "Alajaam", identifier: "AJ-2" },
  ],
  period: { from: "2025-11-01", to: "2026-11-20" },
  generatedAt: "2026-11-21T10:00:00Z",
  plan: [{ title: "Termograafia", installationId: "i1", nextDueOn: "2027-01-15", frequency: "recurring", responsible: "Kati" }],
  log: [
    { id: "c1", occurredAt: "2026-03-02T10:00:00Z", entryType: "inspection", description: "Parandatud näit 12 MΩ", result: null, createdByName: "Kati", performedByName: null, correctionOfId: "o1", correctionReason: "vale näit", installationId: "i1", photosUrl: null },
    { id: "o2", occurredAt: "2026-04-01T08:00:00Z", entryType: "maintenance", description: "Hooldus tehtud", result: "Korras", createdByName: "Kati", performedByName: "Jaan", correctionOfId: null, correctionReason: null, installationId: "i2", photosUrl: "https://drive.example.com/foto" },
    { id: "o1", occurredAt: "2026-03-01T09:00:00Z", entryType: "measurement", description: "Isolatsioonitakistus 1,2 MΩ", result: null, createdByName: "Kati", performedByName: null, correctionOfId: null, correctionReason: null, installationId: "i1", photosUrl: null },
  ],
  deficiencies: [
    { title: "Kilbi uks ei sulgu", installationId: "i1", severity: "medium", status: "open", detectedAt: "2026-05-01T00:00:00Z", dueOn: "2026-12-01", resolution: null, resolvedAt: null, photosUrl: null },
    { title: "Märgistus puudus", installationId: "i2", severity: "low", status: "resolved", detectedAt: "2026-02-01T00:00:00Z", dueOn: null, resolution: "Märgistus lisatud", resolvedAt: "2026-02-10T00:00:00Z", photosUrl: null },
  ],
  documents: [{ title: "Ühejooneskeem", category: "single_line_diagram", installationId: "i1", url: "https://drive.example.com/skeem" }],
  audits: [{ installationId: "i1", auditedOn: "2025-11-01", result: "Positiivne", auditor: "Auditor OÜ", documentUrl: "https://drive.example.com/audit" }],
  nextAudits: [{ installationId: "i1", nextDueOn: "2027-11-01" }],
};

test("audit package: the six parts in order, titled 'Kokkuvõte audiitorile'", () => {
  const r = buildAuditPackage(sample, tFor(et, "et"));
  assert.equal(r.title, "Kokkuvõte audiitorile");
  assert.deepEqual(
    r.sections.map((s) => s.title),
    ["Kaaneleht", "Kehtiv käidukava", "Käidupäevik", "Puudused", "Dokumendid", "Korraline audit"],
  );
  const cover = r.sections[0];
  assert.equal(cover.kind, "facts");
  if (cover.kind === "facts") {
    const facts = Object.fromEntries(cover.rows);
    assert.equal(facts["Objekt"], "Mustamäe tee 5");
    assert.equal(facts["Paigaldised"], "PJK-1 Peajaotuskilp, AJ-2 Alajaam");
    assert.equal(facts["Käidukorraldaja"], "Mari Käidukorraldaja");
    assert.equal(facts["Ettevõte"], "Näidis Elekter OÜ");
    assert.equal(facts["Perioodi algus"], "01.11.2025");
    assert.equal(facts["Perioodi lõpp"], "20.11.2026");
    assert.equal(facts["Koostatud"], "21.11.2026");
  }
});

test("operating log: each correction directly after its original", () => {
  const r = buildAuditPackage(sample, tFor(et, "et"));
  const log = r.sections[2];
  assert.equal(log.kind, "table");
  if (log.kind === "table") {
    const d = log.rows.map((row) => row.description);
    assert.match(d[0], /^Isolatsioonitakistus 1,2 MΩ/);
    assert.match(d[1], /^↳ Parandus: vale näit\nParandatud näit 12 MΩ/);
    assert.match(d[2], /^Hooldus tehtud/);
  }
  assert.deepEqual(orderWithCorrections(sample.log).map((e) => e.id), ["o1", "c1", "o2"]);
});

test("deficiencies open and closed; documents with links incl. photo links; audit data and next deadline", () => {
  const r = buildAuditPackage(sample, tFor(et, "et"));
  const [, , , def, docs, audit] = r.sections;
  if (def.kind !== "table" || docs.kind !== "table" || audit.kind !== "table") throw new Error("tables expected");
  assert.deepEqual(def.rows.map((x) => x.status), ["Avatud", "Lahendatud"]);
  assert.match(def.rows[1].resolution, /Märgistus lisatud/);
  assert.deepEqual(docs.rows.map((x) => x.link), ["https://drive.example.com/skeem", "https://drive.example.com/foto"]);
  assert.equal(docs.rows[1].category, "Foto");
  assert.deepEqual(audit.rows[0], {
    installation: "PJK-1 Peajaotuskilp", audited: "01.11.2025", result: "Positiivne", auditor: "Auditor OÜ", link: "https://drive.example.com/audit", next: "01.11.2027",
  });
  assert.equal(audit.rows[1].audited, "", "an installation without an audit stays empty, nothing invented");
});

test("no claim about an official form, in any language", () => {
  for (const [m, l] of [[et, "et"], [en, "en"], [ru, "ru"]] as const) {
    const text = JSON.stringify(buildAuditPackage(sample, tFor(m as typeof et, l))) + JSON.stringify(m.app.auditPackage);
    assert.doesNotMatch(text, /TTJA|ametlik|official|официальн|vorm(i|ile)\b|form\b/i, l);
  }
});

test("default period: from the earliest of the installations' latest audits, else 12 months back", () => {
  assert.equal(defaultPeriodStart([{ installationId: "a", auditedOn: "2025-01-01" }, { installationId: "a", auditedOn: "2025-06-01" }, { installationId: "b", auditedOn: "2025-03-01" }], "2026-11-21"), "2025-03-01");
  assert.equal(defaultPeriodStart([], "2026-11-21"), "2025-11-21");
});

test("the PDF is generated from the sample data and contains all six parts", async () => {
  const t = tFor(et, "et");
  const r = buildAuditPackage(sample, t);
  const doc = reportDocument(r, t) as { content: unknown[] };
  const headings = JSON.stringify(doc.content);
  for (const title of ["Kokkuvõte audiitorile", "Kaaneleht", "Kehtiv käidukava", "Käidupäevik", "Puudused", "Dokumendid", "Korraline audit"]) {
    assert.ok(headings.includes(JSON.stringify(title)), title);
  }
  const pdf = await renderPdf(r, t);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 5000, "a real document");
});
