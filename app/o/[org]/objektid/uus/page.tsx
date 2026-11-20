import type { Metadata } from "next";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { SiteForm } from "@/components/sites/site-form";
import { getT } from "@/lib/i18n/server";

// Reads request data (session, language cookie, params): allowed to block on navigation
// instead of claiming an instant static shell (Next 16.4 instant validation).
export const instant = false;


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.sites.new };
}

export default async function NewSitePage({ params }: { params: Promise<{ org: string }> }) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      minRole="admin"
      render={({ org }) => {
        const base = `/o/${org.slug}/objektid`;
        return (
          <>
            <PageHeader eyebrow={org.name} title={t.app.sites.new} back={{ href: base, label: t.app.sites.title }} />
            <SiteForm orgSlug={org.slug} cancelHref={base} />
          </>
        );
      }}
    />
  );
}
