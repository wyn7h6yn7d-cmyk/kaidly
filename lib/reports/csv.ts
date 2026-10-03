import type { Column, Row } from "./types.ts";

/**
 * CSV for spreadsheets: UTF-8 with a byte-order mark (Excel then shows õ, ä, ö, ü and
 * Cyrillic correctly), semicolon separators (the Estonian Excel default), CRLF line ends,
 * every field quoted when needed. Values are plain text — never HTML.
 */
export function toCsv(columns: Column[], rows: Row[]): string {
  const cell = (value: string | undefined) => {
    const text = (value ?? "").replace(/\r\n?/g, "\n");
    // Neutralise spreadsheet formulas: =, +, -, @, tab or a line break (CR is normalised to
    // LF above) at the start (OWASP CSV injection).
    const safe = /^[=+\-@\t\n]/.test(text) ? `'${text}` : text;
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [columns.map((c) => cell(c.label)).join(";"), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(";"))];
  return `﻿${lines.join("\r\n")}\r\n`;
}
