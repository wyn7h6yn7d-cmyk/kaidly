import type { Metadata } from "next";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { SiteForm } from "@/components/sites/site-form";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.app.sites.new };

export default function NewSitePage({ params }: { params: Promise<{ org: string }> }) {
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
