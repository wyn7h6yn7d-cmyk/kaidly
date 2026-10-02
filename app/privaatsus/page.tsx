import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { getT } from "@/lib/i18n/server";
import { LEGAL_CONTENT } from "@/lib/legal/content";
import { legalReady } from "@/lib/legal/operator";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: LEGAL_CONTENT[t.locale].privacy.title,
    alternates: { canonical: "/privaatsus" },
    // Drafts are not indexed until the operator facts are confirmed and approved.
    robots: legalReady() ? undefined : { index: false, follow: true },
  };
}

export default function Page() {
  return <LegalPage doc="privacy" />;
}
