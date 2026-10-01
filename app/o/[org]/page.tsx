import Link from "next/link";
import { ChevronRight, Plus, UserPlus } from "lucide-react";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { ComingSoon, EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/lib/auth/roles";
import { getOverviewCounts, listSites } from "@/lib/data/sites";
import { t } from "@/lib/i18n";

const SITES_SHOWN = 8;

export default function OverviewPage({ params }: { params: Promise<{ org: string }> }) {
  return (
    <OrgPage
      params={params}
      render={async ({ org, role }) => {
        const [counts, sites] = await Promise.all([getOverviewCounts(org.id), listSites(org.id)]);
        const isAdmin = hasRole(role, "admin");
        const base = `/o/${org.slug}`;

        return (
          <>
            <PageHeader
              eyebrow={t.app.nav.overview}
              title={org.name}
              description={`${t.app.organisations.yourRole}: ${t.roles[role]}`}
              actions={
                isAdmin ? (
                  <Button asChild variant="outline">
                    <Link href={`${base}/seaded/liikmed`}>
                      <UserPlus aria-hidden="true" />
                      {t.app.invitations.title}
                    </Link>
                  </Button>
                ) : undefined
              }
            />

            <section aria-labelledby="overview-sites">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 id="overview-sites" className="text-xl font-bold">
                  {t.app.overview.sitesTitle}
                </h2>
                <p className="text-sm tabular-nums text-k-muted">
                  {t.app.overview.counts(counts.sites, counts.installations)}
                </p>
              </div>

              {sites.length === 0 ? (
                <EmptyState
                  title={t.app.sites.emptyTitle}
                  body={isAdmin ? t.app.sites.emptyAdmin : t.app.sites.emptyMember}
                  action={
                    isAdmin ? (
                      <Button asChild>
                        <Link href={`${base}/objektid/uus`}>
                          <Plus aria-hidden="true" />
                          {t.app.sites.add}
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
                    {sites.slice(0, SITES_SHOWN).map((site) => (
                      <li key={site.id}>
                        <Link
                          href={`${base}/objektid/${site.id}`}
                          className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-k-paper-2 sm:px-5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{site.name}</span>
                            {site.address && (
                              <span className="block truncate text-sm text-k-muted">{site.address}</span>
                            )}
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-k-muted">
                            {t.app.sites.installationsCount(site.installationCount)}
                          </span>
                          <ChevronRight className="size-5 shrink-0 text-k-grey" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4">
                    <Link
                      href={`${base}/objektid`}
                      className="text-sm font-semibold text-k-green underline underline-offset-4"
                    >
                      {t.app.overview.allSites}
                    </Link>
                  </p>
                </>
              )}
            </section>

            <div className="mt-12">
              <ComingSoon title={`${t.app.nav.log}, ${t.app.nav.schedule.toLowerCase()} ja ${t.app.nav.deficiencies.toLowerCase()}`} />
            </div>
          </>
        );
      }}
    />
  );
}
