import "server-only";
import path from "node:path";
import pdfmake from "pdfmake";
import type { T } from "@/lib/i18n";
import type { Report, Section } from "./types";

// PDF from structured report data (pdfmake → pdfkit), never from screenshots. A4, KAIDLY
// header and footer on every page with page numbers, tables whose header row repeats on
// each page. Greys and black only, plus one thin brand rule, so it prints well in black
// and white. Roboto (bundled with pdfmake) covers Estonian and Cyrillic.

const FONT_DIR = path.join(process.cwd(), "node_modules", "pdfmake", "fonts", "Roboto");
let configured = false;

function configure() {
  if (configured) return;
  const f = (name: string) => path.join(FONT_DIR, name);
  pdfmake.setFonts({
    Roboto: {
      normal: f("Roboto-Regular.ttf"),
      bold: f("Roboto-Medium.ttf"),
      italics: f("Roboto-Italic.ttf"),
      bolditalics: f("Roboto-MediumItalic.ttf"),
    },
  });
  // No network access at all, and only the bundled fonts from disk.
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((p) => path.resolve(p).startsWith(FONT_DIR));
  configured = true;
}

const INK = "#111827";
const MUTED = "#4B5563";
const LINE = "#BFBFBF";
const HEAD_FILL = "#EDEDED";
const GREEN = "#0F3D32";

function section(s: Section): Record<string, unknown>[] {
  const heading = { text: s.title, style: "h2", margin: [0, 14, 0, 6] };
  if (s.kind === "facts") {
    return [
      heading,
      {
        table: { widths: [130, "*"], body: s.rows.map(([k, v]) => [{ text: k, style: "factKey" }, { text: v || "—" }]) },
        layout: "noBorders",
      },
    ];
  }
  if (s.rows.length === 0) return [heading, { text: s.empty, color: MUTED, italics: true }];
  const sum = s.columns.reduce((n, c) => n + (c.width ?? 1), 0);
  return [
    heading,
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: s.columns.map((c) => `${(((c.width ?? 1) / sum) * 100).toFixed(2)}%`),
        body: [
          s.columns.map((c) => ({ text: c.label, style: "th" })),
          ...s.rows.map((r) => s.columns.map((c) => ({ text: r[c.key] ?? "" }))),
        ],
      },
      layout: {
        hLineWidth: (i: number) => (i === 1 ? 0.8 : 0.4),
        vLineWidth: () => 0,
        hLineColor: () => LINE,
        fillColor: (row: number) => (row === 0 ? HEAD_FILL : null),
        paddingTop: () => 3,
        paddingBottom: () => 3,
        paddingLeft: () => 4,
        paddingRight: () => 4,
      },
      style: "table",
    },
  ];
}

export async function reportPdf(report: Report, t: T): Promise<Buffer> {
  configure();
  const generated = t.reports.generated(t.fmt.dateTime(report.generatedAt));
  const doc = {
    pageSize: "A4",
    pageOrientation: report.orientation,
    pageMargins: [36, 64, 36, 44],
    info: { title: `${report.title} · ${report.company}`, author: "KAIDLY", creator: "KAIDLY", producer: "KAIDLY" },
    defaultStyle: { font: "Roboto", fontSize: 8.5, color: INK, lineHeight: 1.15 },
    styles: {
      title: { fontSize: 18, bold: true, margin: [0, 0, 0, 2] },
      scope: { fontSize: 11, color: MUTED, margin: [0, 0, 0, 10] },
      h2: { fontSize: 11.5, bold: true },
      th: { bold: true, fontSize: 8 },
      factKey: { color: MUTED },
      table: { fontSize: 8.5 },
    },
    header: (_page: number, _count: number, size: { width: number }) => ({
      margin: [36, 24, 36, 0],
      stack: [
        {
          columns: [
            { text: [{ text: "KAIDLY", bold: true, color: GREEN }, { text: `  ${report.company}`, color: MUTED }], width: "*" },
            { text: report.title, alignment: "right", color: MUTED, width: "auto" },
          ],
        },
        { canvas: [{ type: "line", x1: 0, y1: 6, x2: size.width - 72, y2: 6, lineWidth: 0.8, lineColor: GREEN }] },
      ],
    }),
    footer: (page: number, count: number) => ({
      margin: [36, 12, 36, 0],
      columns: [
        { text: `${t.reports.brand} · ${generated}`, color: MUTED, fontSize: 7.5 },
        { text: t.reports.page(page, count), alignment: "right", color: MUTED, fontSize: 7.5 },
      ],
    }),
    content: [
      { text: report.title, style: "title" },
      { text: report.scope, style: "scope" },
      ...(report.filters.length
        ? [
            {
              table: { widths: [110, "*"], body: report.filters.map(([k, v]) => [{ text: k, style: "factKey" }, v]) },
              layout: "noBorders",
              margin: [0, 0, 0, 4],
            },
          ]
        : []),
      ...(report.truncated ? [{ text: t.reports.truncated(report.sections.find((s) => s.kind === "table")?.rows.length ?? 0), bold: true, margin: [0, 4, 0, 0] }] : []),
      ...report.sections.flatMap((s) => section(s)),
    ],
  };
  return pdfmake.createPdf(doc).getBuffer();
}
