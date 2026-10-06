import type { Metadata } from "next";
import { GuidedEmptyState } from "@/components/app/guided-empty";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";

import { InstallationForm } from "@/components/sites/installation-form";
import { PlanLimitNotice } from "@/components/organisations/plan-summary";
import { getOrgPlan, installationsFull } from "@/lib/data/plan";

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
        const [{ objekt }, sites, plan] = await Promise.all([searchParams, listActiveSiteOptions(org.id), getOrgPlan(org.id)]);
        // Only preselect a site that is one of this organisation's active sites.
        const preselected = sites.find((site) => site.id === objekt);
        const back = preselected
          ? { href: `/o/${org.slug}/objektid/${preselected.id}`, label: preselected.name }
          : { href: `/o/${org.slug}/objektid`, label: t.app.sites.title };

        return (
          <>
            <PageHeader eyebrow={org.name} title={t.app.installations.new} back={back} />
            {installationsFull(plan) ? (
              <PlanLimitNotice kind="installations" orgName={org.name} trial={plan.status === "trial" && !plan.plan} />
            ) : sites.length === 0 ? (
              <GuidedEmptyState
                title={t.app.emptyStates.installations.title}
                body={t.app.emptyStates.installations.body}
                examples={{ label: t.app.emptyStates.examples, items: t.app.emptyStates.installations.examples }}
                prerequisite={{
                  text: t.app.emptyStates.installations.noSite,
                  action: { href: `/o/${org.slug}/objektid/uus`, label: t.app.emptyStates.installations.noSiteCta },
                }}
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
