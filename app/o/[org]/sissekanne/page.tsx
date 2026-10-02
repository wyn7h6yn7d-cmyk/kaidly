import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { listRecentInstallationIds } from "@/lib/data/dashboard";
import { listInstallationOptions, type InstallationOption } from "@/lib/data/log";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.quickEntry.title };
}

function InstallationLink({
  href,
  installation,
  context,
}: {
  href: string;
  installation: InstallationOption;
  context?: string;
}) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-k-paper-2 sm:px-5">
        <span className="min-w-0 flex-1">
          {installation.identifier && (
            <span className="mr-2 font-mono text-sm font-semibold text-k-green">{installation.identifier}</span>
          )}
          <span className="font-semibold [overflow-wrap:anywhere]">{installation.name}</span>
          {context && <span className="block text-sm text-k-muted">{context}</span>}
        </span>
        <ChevronRight className="size-5 shrink-0 text-k-grey" aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * Quick entry from anywhere in the organisation: pick the installation, land on its entry
 * form. Recently used installations first; with a single installation, go straight there.
 */
export default async function QuickEntryPage({ params }: { params: Promise<{ org: string }> }) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      minRole="operator"
      render={async ({ org, user }) => {
        const [installations, recentIds] = await Promise.all([
          listInstallationOptions(org.id),
          listRecentInstallationIds(org.id, user.id),
        ]);
        const active = installations.filter((i) => !i.archived);
        const entryHref = (id: string) => `/o/${org.slug}/paigaldised/${id}/paevik/uus`;
        if (active.length === 1) redirect(entryHref(active[0].id));

        const copy = t.app.quickEntry;
        const byId = new Map(active.map((i) => [i.id, i]));
        const recent = recentIds.map((id) => byId.get(id)).filter((i): i is InstallationOption => Boolean(i));
        const bySite = new Map<string, { name: string; items: InstallationOption[] }>();
        for (const installation of active) {
          const group = bySite.get(installation.siteId) ?? { name: installation.siteName, items: [] };
          group.items.push(installation);
          bySite.set(installation.siteId, group);
        }

        return (
          <>
            <PageHeader
              eyebrow={org.name}
              title={copy.title}
              description={copy.intro}
              back={{ href: `/o/${org.slug}`, label: t.app.nav.overview }}
            />
            {active.length === 0 ? (
              <EmptyState title={copy.none} />
            ) : (
              <div className="grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-8">
                {recent.length > 0 && (
                  <section aria-labelledby="quick-recent">
                    <h2 id="quick-recent" className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-k-muted">
                      {copy.recent}
                    </h2>
                    <ul aria-label={copy.recent} className="divide-y divide-k-line border border-k-line bg-k-surface">
                      {recent.map((installation) => (
                        <InstallationLink
                          key={installation.id}
                          href={entryHref(installation.id)}
                          installation={installation}
                          context={installation.siteName}
                        />
                      ))}
                    </ul>
                  </section>
                )}
                <section aria-labelledby="quick-all" className="grid gap-5">
                  <h2 id="quick-all" className="text-sm font-semibold uppercase tracking-[0.12em] text-k-muted">
                    {copy.all}
                  </h2>
                  {[...bySite.entries()].map(([siteId, group]) => (
                    <div key={siteId}>
                      <h3 className="mb-2 font-bold">{group.name}</h3>
                      <ul aria-label={copy.listLabel(group.name)} className="divide-y divide-k-line border border-k-line bg-k-surface">
                        {group.items.map((installation) => (
                          <InstallationLink key={installation.id} href={entryHref(installation.id)} installation={installation} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              </div>
            )}
          </>
        );
      }}
    />
  );
}
