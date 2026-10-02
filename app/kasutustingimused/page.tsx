import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { getT } from "@/lib/i18n/server";
import { LEGAL_CONTENT } from "@/lib/legal/content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: LEGAL_CONTENT[t.locale].terms.title, alternates: { canonical: "/kasutustingimused" } };
}

export default function Page() {
  return <LegalPage doc="terms" />;
}
