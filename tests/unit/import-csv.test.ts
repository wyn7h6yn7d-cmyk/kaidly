import { test } from "node:test";
import assert from "node:assert/strict";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, parseCsvText, parseImportFile } from "../../lib/import/csv.ts";

const bytes = (text: string) => new TextEncoder().encode(text);

test("parses quoted fields, doubled quotes, embedded delimiters and line breaks", () => {
  const parsed = parseCsvText('name,address\n"Kilp, ""A""","Tee 1\nKorpus 2"\r\nB,\n\n');
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.records, [["name", "address"], ['Kilp, "A"', "Tee 1\nKorpus 2"], ["B", ""]]);
});

test("detects the semicolon delimiter of Estonian spreadsheets and strips the BOM", () => {
  const result = parseImportFile("sites", bytes("﻿name;address\nKase 4;Kase 4, Tallinn\n"));
  assert.ok(result.ok);
  assert.equal(result.rows[0].values.name, "Kase 4");
  assert.equal(result.rows[0].values.address, "Kase 4, Tallinn");
  assert.deepEqual(result.rows[0].issues, []);
});

test("rejects invalid UTF-8, oversized files, too many rows and an unterminated quote", () => {
  assert.deepEqual(parseImportFile("sites", new Uint8Array([0x6e, 0x61, 0xff, 0x0a])), { ok: false, error: "import_encoding" });
  assert.equal((parseImportFile("sites", new Uint8Array(IMPORT_MAX_BYTES + 1)) as { error: string }).error, "import_file_too_large");
  const many = "name\n" + Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => `S${i}`).join("\n");
  assert.equal((parseImportFile("sites", bytes(many)) as { error: string }).error, "import_too_many_rows");
  assert.equal((parseImportFile("sites", bytes('name\n"open')) as { error: string }).error, "import_malformed");
  assert.equal((parseImportFile("sites", bytes("name\n")) as { error: string }).error, "import_empty");
});

test("reports a missing required column", () => {
  const result = parseImportFile("installations", bytes("name,identifier\nKilp,PK-1\n"));
  assert.deepEqual(result, { ok: false, error: "import_header_invalid", detail: "site" });
});

test("flags row problems with the row number", () => {
  const csv = [
    "site,name,identifier,type,commissioned_on,extra",
    "Objekt,Peakilp,PK-1,switchboard,2020-05-01,x",
    "Objekt,Teine,pk-1,,2026-02-30,",
    ",Ilma objektita,,reactor,,",
    "Objekt,,,,01.02.2020,",
    "Objekt,=HYPERLINK(1),,,,",
  ].join("\n");
  const result = parseImportFile("installations", bytes(csv));
  assert.ok(result.ok);
  assert.deepEqual(result.unknownColumns, ["extra"]);
  assert.deepEqual(result.rows.map((r) => [r.line, r.issues.sort()]), [
    [1, []],
    [2, ["import_date_invalid", "import_duplicate_identifier"]],
    [3, ["import_site_missing", "import_type_invalid"]],
    [4, ["import_date_invalid", "import_name_required"]],
    [5, ["import_formula_value"]],
  ]);
});

test("duplicate site rows and over-long values", () => {
  const result = parseImportFile("sites", bytes(`name,address\nA,\na,\nB,${"x".repeat(301)}\n`));
  assert.ok(result.ok);
  assert.deepEqual(result.rows.map((r) => r.issues), [[], ["import_duplicate_row"], ["import_value_too_long"]]);
});
