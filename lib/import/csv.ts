/**
 * CSV import (v1): parsing and row validation shared by the browser preview and the
 * server action. The database function `import_company_data` validates again and is
 * authoritative; this module only makes problems visible before anything is sent.
 *
 * Technical safety limits (not commercial quotas): 1 MB file, 1000 data rows,
 * 30 columns, field lengths as in the database.
 */

export const IMPORT_MAX_BYTES = 1024 * 1024;
export const IMPORT_MAX_ROWS = 1000;
const MAX_COLUMNS = 30;

export const IMPORT_KINDS = ["sites", "installations"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const INSTALLATION_TYPES = [
  "building",
  "switchboard",
  "substation",
  "solar",
  "storage",
  "charging",
  "industrial",
  "other",
] as const;

/** Column keys per import type (the template header row), with database length limits. */
export const IMPORT_COLUMNS: Record<ImportKind, { key: string; required?: boolean; max: number }[]> = {
  sites: [
    { key: "name", required: true, max: 200 },
    { key: "address", max: 300 },
    { key: "responsible_person", max: 200 },
    { key: "description", max: 5000 },
  ],
  installations: [
    { key: "site", required: true, max: 200 },
    { key: "name", required: true, max: 200 },
    { key: "identifier", max: 50 },
    { key: "type", max: 30 },
    { key: "location", max: 200 },
    { key: "commissioned_on", max: 10 },
    { key: "responsible_person", max: 200 },
    { key: "notes", max: 5000 },
  ],
};

export type ImportIssue =
  | "import_name_required"
  | "import_site_missing"
  | "import_value_too_long"
  | "import_formula_value"
  | "import_duplicate_row"
  | "import_duplicate_identifier"
  | "import_type_invalid"
  | "import_date_invalid";

export type ImportFileError =
  | "import_file_too_large"
  | "import_encoding"
  | "import_empty"
  | "import_too_many_rows"
  | "import_header_invalid"
  | "import_malformed";

export type ImportRow = {
  /** 1-based data row number (the header is not counted). */
  line: number;
  values: Record<string, string>;
  issues: ImportIssue[];
};

export type ParsedImport =
  | { ok: false; error: ImportFileError; detail?: string }
  | { ok: true; rows: ImportRow[]; unknownColumns: string[] };

/** Decodes the file strictly as UTF-8 (an optional BOM is removed). */
export function decodeCsv(bytes: Uint8Array): { ok: true; text: string } | { ok: false; error: ImportFileError } {
  if (bytes.byteLength > IMPORT_MAX_BYTES) return { ok: false, error: "import_file_too_large" };
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, text: text.replace(/^﻿/, "") };
  } catch {
    return { ok: false, error: "import_encoding" };
  }
}

/**
 * RFC 4180 style parser: quoted fields, doubled quotes, delimiters and line breaks inside
 * quotes. The delimiter is detected from the header (Estonian spreadsheets export `;`).
 */
export function parseCsvText(text: string): { ok: true; records: string[][] } | { ok: false; error: ImportFileError } {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = "";
      if (record.length > MAX_COLUMNS) return { ok: false, error: "import_malformed" };
    } else if (ch === "\n" || ch === "\r") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      if (records.length > IMPORT_MAX_ROWS + 1) return { ok: false, error: "import_too_many_rows" };
    } else {
      field += ch;
    }
    i += 1;
  }
  if (quoted) return { ok: false, error: "import_malformed" };
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  // Blank lines (e.g. a trailing newline or spreadsheet padding) are not rows.
  return { ok: true, records: records.filter((r) => r.some((v) => v.trim() !== "")) };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= "2100-12-31";
}

/** Validates rows as the database will (except checks against existing records). */
export function validateRows(kind: ImportKind, rows: { line: number; values: Record<string, string> }[]): ImportRow[] {
  const columns = IMPORT_COLUMNS[kind];
  const seen = new Map<string, number>();
  return rows.map(({ line, values }) => {
    const issues = new Set<ImportIssue>();
    const clean: Record<string, string> = {};
    for (const column of columns) {
      const value = (values[column.key] ?? "").trim();
      clean[column.key] = value;
      if (!value) continue;
      if (value.length > column.max) issues.add("import_value_too_long");
      if (value.startsWith("=") || value.startsWith("@")) issues.add("import_formula_value");
    }
    if (!clean.name) issues.add("import_name_required");
    if (kind === "sites" && clean.name) {
      const key = clean.name.toLowerCase();
      if (seen.has(key)) issues.add("import_duplicate_row");
      else seen.set(key, line);
    }
    if (kind === "installations") {
      if (!clean.site) issues.add("import_site_missing");
      if (clean.identifier && clean.site) {
        const key = `${clean.site.toLowerCase()}/${clean.identifier.toLowerCase()}`;
        if (seen.has(key)) issues.add("import_duplicate_identifier");
        else seen.set(key, line);
      }
      if (clean.type && !(INSTALLATION_TYPES as readonly string[]).includes(clean.type.toLowerCase())) {
        issues.add("import_type_invalid");
      }
      if (clean.commissioned_on && !validDate(clean.commissioned_on)) issues.add("import_date_invalid");
    }
    return { line, values: clean, issues: [...issues] };
  });
}

/** Bytes → validated rows for the preview. */
export function parseImportFile(kind: ImportKind, bytes: Uint8Array): ParsedImport {
  const decoded = decodeCsv(bytes);
  if (!decoded.ok) return decoded;
  const parsed = parseCsvText(decoded.text);
  if (!parsed.ok) return parsed;
  const [header, ...data] = parsed.records;
  if (!header || data.length === 0) return { ok: false, error: "import_empty" };
  if (data.length > IMPORT_MAX_ROWS) return { ok: false, error: "import_too_many_rows" };
  const keys = header.map((h) => h.trim().toLowerCase());
  const known = new Set(IMPORT_COLUMNS[kind].map((c) => c.key));
  const missing = IMPORT_COLUMNS[kind].filter((c) => c.required && !keys.includes(c.key)).map((c) => c.key);
  if (missing.length > 0) return { ok: false, error: "import_header_invalid", detail: missing.join(", ") };
  const rows = data.map((record, index) => ({
    line: index + 1,
    values: Object.fromEntries(keys.map((key, i) => [key, record[i] ?? ""]).filter(([key]) => known.has(key))),
  }));
  return { ok: true, rows: validateRows(kind, rows), unknownColumns: keys.filter((k) => k && !known.has(k)) };
}
