import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { getMySiteAccess } from "@/lib/data/site-viewers";
import { getT } from "@/lib/i18n/server";
import { buildReport } from "@/lib/reports/build";
import { toCsv } from "@/lib/reports/csv";
import { reportFileName } from "@/lib/reports/filename";
import { parseFilters } from "@/lib/reports/filters";
import { todayInTallinn } from "@/lib/time";
import { isUuid } from "@/lib/validation/sites";

/** Objekti vaataja: the operating log of their site (optionally one installation) as CSV, read-only, via RLS. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  if (!isUuid(site)) notFound();
  const access = (await getMySiteAccess()).find((s) => s.siteId === site);
  if (!access) notFound();
  const installation = request.nextUrl.searchParams.get("paigaldis");
  const filters = parseFilters({ objekt: site, ...(installation && isUuid(installation) ? { paigaldis: installation } : {}) });
  const t = await getT();
  const data = await buildReport("log", { org: { id: access.organisationId, name: access.organisationName } }, t, filters);
  if (!data?.csv) notFound();
  const name = reportFileName("log", data.fileScope, "kaidly", todayInTallinn(), "csv");
  return new Response(toCsv(data.csv.columns, data.csv.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
