// Structured report data — one shape for preview, PDF and CSV (no screenshots, no HTML).

export const REPORT_KINDS = ["log", "plan", "deficiencies", "documents", "site", "installation"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
/** Reports with one main table that can also be exported as CSV. */
export const TABULAR: readonly ReportKind[] = ["log", "plan", "deficiencies", "documents"];

export type Column = { key: string; label: string; /** relative PDF width */ width?: number };
export type Row = Record<string, string>;

export type Section =
  | { kind: "facts"; title: string; rows: [string, string][] }
  | {
      kind: "table";
      title: string;
      columns: Column[];
      rows: Row[];
      empty: string;
      /** Matching records in the database (rows may be capped). */
      total: number;
    };

export type Report = {
  kind: ReportKind;
  title: string;
  company: string;
  /** What the report covers, e.g. "Tallinna tehas · PK-01". */
  scope: string;
  filters: [string, string][];
  generatedAt: string;
  sections: Section[];
  /** CSV of the main table: raw, machine-readable values. */
  csv?: { columns: Column[]; rows: Row[] };
  truncated: boolean;
  orientation: "portrait" | "landscape";
  /** For the file name. */
  fileScope: string;
};

export const MAX_EXPORT_ROWS = 5000;
export const PREVIEW_ROWS = 25;
