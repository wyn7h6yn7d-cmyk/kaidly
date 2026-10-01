import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Pencil, Plus } from "lucide-react";
import { DetailList } from "@/components/app/detail-list";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { ArchivedBadge, StatusMark } from "@/components/sites/status-mark";
import { Button } from "@/components/ui/button";
import { setSiteArchived } from "@/lib/actions/sites";
import { hasRole } from "@/lib/auth/roles";
import { getSite, listSiteInstallations } from "@/lib/data/sites";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.app.sites.title };

export default function SitePage({ params }: { params: Promise<{ org: string; site: string }> }) {
  return (
    <OrgPage
      params={params}
      render={async ({ org, role }) => {
        const { site: siteId } = await params;
        const site = await getSite(org.id, siteId);
        if (!site) notFound();
        const installations = await listSiteInstallations(org.id, site.id);
        const active = installations.filter((i) => !i.archivedAt);
        const archived = installations.filter((i) => i.archivedAt);
        const isAdmin = hasRole(role, "admin");
        const copy = t.app.sites;
        const base = `/o/${org.slug}`;
        const canAdd = isAdmin && !site.archivedAt;

        return (
          <>
            <PageHeader
              title={site.name}
              description={site.address ?? undefined}
              back={{ href: `${base}/objektid`, label: copy.title }}
              actions={
                isAdmin ? (
                  <>
                    <Button asChild variant="outline">
                      <Link href={`${base}/objektid/${site.id}/muuda`}>
                        <Pencil aria-hidden="true" />
                        {copy.edit}
                      </Link>
                    </Button>
                    {canAdd && (
                      <Button asChild>
                        <Link href={`${base}/paigaldised/uus?objekt=${site.id}`}>
                          <Plus aria-hidden="true" />
                          {t.app.installations.add}
                        </Link>
                      </Button>
                    )}
                  </>
                ) : undefined
              }
            />

            {site.archivedAt && (
              <div className="mb-8 flex flex-col gap-3 border-l-4 border-k-grey bg-k-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p>{copy.archivedBanner}</p>
                {isAdmin && (
                  <ConfirmForm
                    action={setSiteArchived}
                    fields={{ orgSlug: org.slug, siteId: site.id, archive: "false" }}
                    label={copy.restore}
                  />
                )}
              </div>
            )}

            <section aria-labelledby="installations">
              <h2 id="installations" className="mb-4 text-xl font-bold">
                {copy.installationsTitle}
              </h2>
              {active.length === 0 ? (
                <EmptyState
                  title={copy.noInstallations}
                  body={canAdd ? copy.noInstallationsAdmin : undefined}
                  action={
                    canAdd ? (
                      <Button asChild>
                        <Link href={`${base}/paigaldised/uus?objekt=${site.id}`}>
                          <Plus aria-hidden="true" />
                          {t.app.installations.add}
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
                  {active.map((installation) => (
                    <li key={installation.id}>
                      <Link
                        href={`${base}/paigaldised/${installation.id}`}
                        className="flex min-h-[72px] items-center gap-4 px-4 py-3 hover:bg-k-paper-2 sm:px-5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-baseline gap-2">
                            {installation.identifier && (
                              <span className="shrink-0 font-mono text-sm font-semibold text-k-green">
                                {installation.identifier}
                              </span>
                            )}
                            <span className="truncate text-[17px] font-semibold">{installation.name}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-sm text-k-muted">
                            {[t.app.installations.types[installation.installationType], installation.location]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="hidden sm:block">
                          <StatusMark status={installation.status} />
                        </span>
                        <ChevronRight className="size-5 shrink-0 text-k-grey" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {archived.length > 0 && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm font-semibold text-k-green">
                    {copy.archivedInstallations(archived.length)}
                  </summary>
                  <ul className="mt-3 divide-y divide-k-line border border-k-line bg-k-surface">
                    {archived.map((installation) => (
                      <li key={installation.id}>
                        <Link
                          href={`${base}/paigaldised/${installation.id}`}
                          className="flex min-h-14 items-center gap-3 px-4 py-2 text-k-muted hover:bg-k-paper-2 sm:px-5"
                        >
                          <span className="min-w-0 flex-1 truncate">{installation.name}</span>
                          <ArchivedBadge label={t.app.installations.archived} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>

            <section aria-labelledby="site-details" className="mt-12">
              <h2 id="site-details" className="mb-4 text-xl font-bold">
                {copy.detailsTitle}
              </h2>
              <DetailList
                items={[
                  { label: copy.fields.address, value: site.address },
                  { label: copy.fields.responsiblePerson, value: site.responsiblePerson },
                  { label: copy.fields.description, value: site.description },
                ]}
              />
            </section>
          </>
        );
      }}
    />
  );
}
