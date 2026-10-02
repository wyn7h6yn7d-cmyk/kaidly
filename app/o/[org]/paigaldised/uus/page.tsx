import type { Metadata } from "next";
import Link from "next/link";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { InstallationForm } from "@/components/sites/installation-form";
import { Button } from "@/components/ui/button";
import { listActiveSiteOptions } from "@/lib/data/sites";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.installations.new };
}

export default async function NewInstallationPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ objekt?: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      minRole="admin"
      render={async ({ org }) => {
        const [{ objekt }, sites] = await Promise.all([searchParams, listActiveSiteOptions(org.id)]);
        // Only preselect a site that is one of this organisation's active sites.
        const preselected = sites.find((site) => site.id === objekt);
        const back = preselected
          ? { href: `/o/${org.slug}/objektid/${preselected.id}`, label: preselected.name }
          : { href: `/o/${org.slug}/objektid`, label: t.app.sites.title };

        return (
          <>
            <PageHeader eyebrow={org.name} title={t.app.installations.new} back={back} />
            {sites.length === 0 ? (
              <EmptyState
                title={t.app.installations.noActiveSites}
                action={
                  <Button asChild>
                    <Link href={`/o/${org.slug}/objektid/uus`}>{t.app.sites.add}</Link>
                  </Button>
                }
              />
            ) : (
              <InstallationForm
                orgSlug={org.slug}
                sites={sites}
                defaultSiteId={preselected?.id}
                cancelHref={back.href}
              />
            )}
          </>
        );
      }}
    />
  );
}
