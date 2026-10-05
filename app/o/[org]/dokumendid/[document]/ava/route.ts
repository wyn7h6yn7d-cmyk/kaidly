import { NextResponse, type NextRequest } from "next/server";
import { getOrgContext } from "@/lib/data/organisations";
import { signDocumentUrl } from "@/lib/data/documents";

/**
 * Opens a document: checks access through RLS and redirects to a 60-second signed URL.
 * Unknown, foreign and incomplete documents, and files missing in Storage, send the member to
 * the document page (which is "not found" for anything they can't see), so nothing reveals
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
    // Unknown, foreign or incomplete documents and documents whose file is missing in Storage
    // all land on the document page with a notice: it shows the ordinary "not found" for
    // anything the member can't see, so nothing reveals another company's documents.
    if (!ctx || !/^[0-9a-f-]{36}$/.test(document)) {
      return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const page = new URL(`/o/${ctx.org.slug}/dokumendid/${document}?fail=puudub`, request.url);
    return NextResponse.redirect(page, { status: 303, headers: { "Cache-Control": "no-store" } });
  }
  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
