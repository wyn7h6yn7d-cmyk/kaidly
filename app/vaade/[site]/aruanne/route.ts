import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { getMySiteAccess } from "@/lib/data/site-viewers";
import { getT } from "@/lib/i18n/server";
import { buildReport } from "@/lib/reports/build";
import { reportFileName } from "@/lib/reports/filename";
import { parseFilters } from "@/lib/reports/filters";
import { reportPdf } from "@/lib/reports/pdf";
import { todayInTallinn } from "@/lib/time";
import { isUuid } from "@/lib/validation/sites";

/**
 * Objekti vaataja: the site summary as PDF, generated on request through the viewer's own
 * session (RLS limits every row to their sites) — never stored, never cached. A site that
 * is not theirs (or no longer active) is the ordinary 404.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  if (!isUuid(site)) notFound();
  const access = (await getMySiteAccess()).find((s) => s.siteId === site);
  if (!access) notFound();

  const t = await getT();
  const ctx = { org: { id: access.organisationId, name: access.organisationName } };
  const data = await buildReport("site", ctx, t, parseFilters({ objekt: site }));
  if (!data) notFound();

  const name = reportFileName("site", data.fileScope, "kaidly", todayInTallinn(), "pdf");
  return new Response(new Uint8Array(await reportPdf(data, t)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
