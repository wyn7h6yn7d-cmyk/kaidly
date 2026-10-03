import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../../lib/reports/csv.ts";
import { fileSafe, reportFileName } from "../../lib/reports/filename.ts";
import { filtersQuery, parseFilters } from "../../lib/reports/filters.ts";

test("CSV: UTF-8 BOM, semicolons, CRLF, Estonian and Russian kept, quoting, no formulas", () => {
  const csv = toCsv(
    [
      { key: "a", label: "Kirjeldus" },
      { key: "b", label: "Описание" },
    ],
    [
      { a: "Õhuliini ülevaatus; märkus", b: "Проверка щита" },
      { a: 'Ütles "korras"\nkaks rida', b: "=SUM(A1)" },
    ],
  );
  assert.ok(csv.startsWith("﻿Kirjeldus;Описание\r\n"));
  assert.ok(csv.includes('"Õhuliini ülevaatus; märkus";Проверка щита\r\n'));
  assert.ok(csv.includes('"Ütles ""korras""\nkaks rida";\'=SUM(A1)\r\n'));
  assert.ok(!/<[a-z]/i.test(csv), "no HTML");
  assert.equal(Buffer.from(csv, "utf8").toString("utf8"), csv);
});

test("file names: deterministic, ASCII, no unsafe characters", () => {
  assert.equal(fileSafe("Tallinna tehas / PK-01"), "Tallinna-tehas-PK-01");
  assert.equal(fileSafe("Kenneth OÜ"), "Kenneth-OU");
  assert.equal(fileSafe("Õismäe šõõr"), "Oismae-soor");
  assert.equal(reportFileName("log", "", "kenneth-ou-3k2a1b", "2026-10-02", "pdf"), "KAIDLY_Kaidupaevik_kenneth-ou-3k2a1b_2026-10-02.pdf");
  assert.equal(reportFileName("deficiencies", "Tallinna tehas", "x", "2026-10-02", "csv"), "KAIDLY_Puudused_Tallinna-tehas_2026-10-02.csv");
  // A Cyrillic-only name falls back to the (ASCII) organisation slug.
  assert.equal(reportFileName("site", "Таллинский завод", "firma-ab12cd", "2026-10-02", "pdf"), "KAIDLY_Objekti-kokkuvote_firma-ab12cd_2026-10-02.pdf");
  assert.match(reportFileName("documents", '../../etc/"passwd"', "x", "2026-10-02", "pdf"), /^KAIDLY_Dokumendiregister_etc-passwd_2026-10-02\.pdf$/);
});

test("filters: only valid values survive and round-trip", () => {
  const f = parseFilters({
    objekt: "9b2f4c1e-0d6a-4f7e-8a51-2c3d4e5f6a7b",
    paigaldis: "not-a-uuid",
    alates: "2026-01-01",
    kuni: "2026-13-99x",
    tyyp: "inspection",
    seis: "hacked",
    raskus: "critical",
    tahtaeg: "overdue",
    liik: "measurement_protocol",
    arhiiv: "1",
  });
  assert.deepEqual(f, {
    site: "9b2f4c1e-0d6a-4f7e-8a51-2c3d4e5f6a7b",
    installation: undefined,
    from: "2026-01-01",
    to: undefined,
    type: "inspection",
    status: undefined,
    severity: "critical",
    due: "overdue",
    category: "measurement_protocol",
    archived: true,
  });
  assert.deepEqual(parseFilters(Object.fromEntries(new URLSearchParams(filtersQuery(f)))), f);
});

test("CSV: every formula trigger at the start of a cell is neutralised, other text is untouched", () => {
  const payloads = ["=1+1", "+cmd|' /C calc'!A0", "-2+3", "@SUM(A1)", "\t=1", "\r=HYPERLINK(\"x\")", "\n=1", "\r\n@x"];
  for (const value of payloads) {
    const csv = toCsv([{ key: "a", label: "A" }], [{ a: value }]);
    const cellText = csv.split("\r\n")[1].replace(/^"|"$/g, "");
    assert.ok(cellText.startsWith("'"), `not neutralised: ${JSON.stringify(value)}`);
  }
  const plain = toCsv([{ key: "a", label: "A" }], [{ a: "Kilp 1 = korras" }]);
  assert.ok(plain.includes("\r\nKilp 1 = korras\r\n"));
});

