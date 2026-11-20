import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { loadAuditPackage } from "@/lib/data/audits";
import { getMySiteAccess } from "@/lib/data/site-viewers";
import { getT } from "@/lib/i18n/server";
import { buildAuditPackage } from "@/lib/reports/audit-package";
import { fileSafe } from "@/lib/reports/filename";
import { reportPdf } from "@/lib/reports/pdf";
import { todayInTallinn } from "@/lib/time";
import { isUuid } from "@/lib/validation/sites";

/** Objekti vaataja: the audit package of one of their sites (RLS limits every row). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  if (!isUuid(site)) notFound();
  const access = (await getMySiteAccess()).find((s) => s.siteId === site);
  if (!access) notFound();
  const q = request.nextUrl.searchParams;
  const data = await loadAuditPackage({ id: access.organisationId, name: access.organisationName }, site, { from: q.get("alates"), to: q.get("kuni") });
  if (!data) notFound();
  const t = await getT();
  const pdf = await reportPdf(buildAuditPackage(data, t), t);
  const name = `KAIDLY_Auditipakett_${fileSafe(data.site.name) || "objekt"}_${todayInTallinn()}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
