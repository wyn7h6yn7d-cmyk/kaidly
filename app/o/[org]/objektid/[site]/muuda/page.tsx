import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { SiteForm } from "@/components/sites/site-form";
import { setSiteArchived } from "@/lib/actions/sites";
import { getSite } from "@/lib/data/sites";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.sites.edit };
}

export default async function EditSitePage({ params }: { params: Promise<{ org: string; site: string }> }) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      minRole="admin"
      render={async ({ org }) => {
        const { site: siteId } = await params;
        const site = await getSite(org.id, siteId);
        if (!site) notFound();
        const siteHref = `/o/${org.slug}/objektid/${site.id}`;
        const copy = t.app.sites;

        return (
          <>
            <PageHeader eyebrow={site.name} title={copy.edit} back={{ href: siteHref, label: site.name }} />
            <SiteForm orgSlug={org.slug} site={site} cancelHref={siteHref} />

            <section aria-labelledby="archive" className="mt-12 max-w-2xl border-t border-k-line pt-8">
              <h2 id="archive" className="text-xl font-bold">
                {site.archivedAt ? copy.restore : copy.archive}
              </h2>
              <p className="mb-4 mt-1 text-k-muted">{copy.archiveBody}</p>
              <ConfirmForm
                action={setSiteArchived}
                fields={{ orgSlug: org.slug, siteId: site.id, archive: site.archivedAt ? "false" : "true" }}
                confirm={site.archivedAt ? undefined : copy.archiveConfirm}
                label={site.archivedAt ? copy.restore : copy.archive}
                variant="outline"
                size="default"
              />
            </section>
          </>
        );
      }}
    />
  );
}
