import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { getOrgContext } from "@/lib/data/organisations";
import { getT } from "@/lib/i18n/server";
import { buildReport } from "@/lib/reports/build";
import { toCsv } from "@/lib/reports/csv";
import { reportFileName } from "@/lib/reports/filename";
import { parseFilters } from "@/lib/reports/filters";
import { reportPdf } from "@/lib/reports/pdf";
import { REPORT_KINDS, type ReportKind, TABULAR } from "@/lib/reports/types";
import { todayInTallinn } from "@/lib/time";

/**
 * Report download, generated on request for the signed-in member and streamed back — no
 * stored file, no public or signed URL, nothing cached. Reading through the user's own
 * session means RLS decides every row; read-only (expired) companies can export.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ org: string; report: string }> }) {
  const { org: slug, report } = await params;
  const kind = REPORT_KINDS.find((k) => k === report) as ReportKind | undefined;
  const format = request.nextUrl.searchParams.get("format");
  if (!kind || (format !== "pdf" && format !== "csv") || (format === "csv" && !TABULAR.includes(kind))) notFound();
  const ctx = await getOrgContext(slug);
  // Not a member (or unknown) and deactivated companies: the ordinary not-found answer.
  if (!ctx || ctx.org.deactivatedAt) notFound();

  const t = await getT();
  const filters = parseFilters(Object.fromEntries(request.nextUrl.searchParams));
  const data = await buildReport(kind, ctx, t, filters);
  if (!data) notFound();

  const name = reportFileName(kind, data.fileScope, ctx.org.slug, todayInTallinn(), format);
  const body = format === "pdf" ? new Uint8Array(await reportPdf(data, t)) : toCsv(data.csv!.columns, data.csv!.rows);
  return new Response(body, {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
