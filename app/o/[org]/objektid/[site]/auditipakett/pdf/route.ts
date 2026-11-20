import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { loadAuditPackage } from "@/lib/data/audits";
import { getOrgContext } from "@/lib/data/organisations";
import { getT } from "@/lib/i18n/server";
import { buildAuditPackage } from "@/lib/reports/audit-package";
import { fileSafe } from "@/lib/reports/filename";
import { reportPdf } from "@/lib/reports/pdf";
import { todayInTallinn } from "@/lib/time";
import { isUuid } from "@/lib/validation/sites";

/**
 * Auditipakett PDF ("Kokkuvõte audiitorile") for a member, generated on request through the
 * user's own session (RLS) — never stored or cached. Unknown/foreign site: 404.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ org: string; site: string }> }) {
  const { org: slug, site } = await params;
  if (!isUuid(site)) notFound();
  const ctx = await getOrgContext(slug);
  if (!ctx || ctx.org.deactivatedAt) notFound();
  const q = request.nextUrl.searchParams;
  const data = await loadAuditPackage(ctx.org, site, { from: q.get("alates"), to: q.get("kuni") });
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
