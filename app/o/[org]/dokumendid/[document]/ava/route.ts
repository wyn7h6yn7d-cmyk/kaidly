import { NextResponse, type NextRequest } from "next/server";
import { getOrgContext } from "@/lib/data/organisations";
import { signDocumentUrl } from "@/lib/data/documents";

/**
 * Opens a document: checks access through RLS and redirects to a 60-second signed URL.
 * Unknown, foreign and incomplete documents all give the same 404, so nothing reveals
 * whether another organisation's document exists. `?lae=1` forces a download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ org: string; document: string }> },
) {
  const { org, document } = await params;
  const ctx = await getOrgContext(org);
  const url = ctx
    ? await signDocumentUrl(ctx.org.id, document, { download: request.nextUrl.searchParams.get("lae") === "1" })
    : null;
  if (!url) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
