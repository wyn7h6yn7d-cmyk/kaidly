import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/lib/auth/roles";
import { countArchivedSites, listSites } from "@/lib/data/sites";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.sites.title };
}

export default async function SitesPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ arhiiv?: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      render={async ({ org, role }) => {
        const { arhiiv } = await searchParams;
        const archived = arhiiv !== undefined;
        const [sites, archivedCount] = await Promise.all([
          listSites(org.id, { archived }),
          archived ? Promise.resolve(0) : countArchivedSites(org.id),
        ]);
        const isAdmin = hasRole(role, "admin");
        const copy = t.app.sites;
        const base = `/o/${org.slug}/objektid`;

        return (
          <>
            <PageHeader
              eyebrow={org.name}
              title={archived ? copy.archivedTitle : copy.title}
              back={archived ? { href: base, label: copy.title } : undefined}
              actions={
                isAdmin && !archived ? (
                  <Button asChild>
                    <Link href={`${base}/uus`}>
                      <Plus aria-hidden="true" />
                      {copy.add}
                    </Link>
                  </Button>
                ) : undefined
              }
            />

            {sites.length === 0 ? (
              archived ? (
                <p className="text-k-muted">{copy.emptyArchived}</p>
              ) : (
                <EmptyState
                  title={copy.emptyTitle}
                  body={isAdmin ? copy.emptyAdmin : copy.emptyMember}
                  action={
                    isAdmin ? (
                      <Button asChild>
                        <Link href={`${base}/uus`}>
                          <Plus aria-hidden="true" />
                          {copy.add}
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              )
            ) : (
              <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
                {sites.map((site) => (
                  <li key={site.id}>
                    <Link
                      href={`${base}/${site.id}`}
                      className="flex min-min-h-[72px] items-center gap-4 px-4 py-3 hover:bg-k-paper-2 sm:px-5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] font-semibold">{site.name}</span>
                        <span className="mt-0.5 block truncate text-sm text-k-muted">
                          {[site.address, site.responsiblePerson].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-k-muted">
                        {copy.installationsCount(site.installationCount)}
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-k-grey" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {!archived && archivedCount > 0 && (
              <p className="mt-6">
                <Link
                  href={`${base}?arhiiv`}
                  className="text-sm font-semibold text-k-green underline underline-offset-4"
                >
                  {copy.showArchived} ({archivedCount})
                </Link>
              </p>
            )}
          </>
        );
      }}
    />
  );
}
