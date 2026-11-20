import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { EmptyState, LoadingBlock } from "@/components/app/states";
import { getMySiteAccess } from "@/lib/data/site-viewers";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.viewer.title };
}

async function SiteList({ searchParams }: { searchParams: Promise<{ vali?: string }> }) {
  const t = await getT();
  const [{ vali }, sites] = await Promise.all([searchParams, getMySiteAccess()]);
  if (sites.length === 1 && vali === undefined) redirect(`/vaade/${sites[0].siteId}`);
  if (sites.length === 0) return <EmptyState title={t.app.viewer.emptyTitle} body={t.app.viewer.emptyBody} />;

  const byCompany = new Map<string, { name: string; sites: typeof sites }>();
  for (const s of sites) {
    const group = byCompany.get(s.organisationId) ?? { name: s.organisationName, sites: [] };
    group.sites.push(s);
    byCompany.set(s.organisationId, group);
  }
  return (
    <div className="flex flex-col gap-8">
      {[...byCompany.entries()].map(([id, group]) => (
        <section key={id} aria-labelledby={`c-${id}`}>
          <h2 id={`c-${id}`} className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-k-muted">
            {t.app.viewer.manager}: <span className="normal-case tracking-normal text-k-ink">{group.name}</span>
          </h2>
          <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
            {group.sites.map((s) => (
              <li key={s.siteId}>
                <Link href={`/vaade/${s.siteId}`} className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-k-paper-2 sm:px-5">
                  <span className="min-w-0 flex-1 break-words text-[17px] font-semibold">{s.siteName}</span>
                  <ChevronRight className="size-5 shrink-0 text-k-grey" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Objekti vaataja: the sites this person was invited to view (read-only). */
export default async function ViewerHomePage({ searchParams }: { searchParams: Promise<{ vali?: string }> }) {
  const t = await getT();
  return (
    <PlainPage>
      <PageHeader title={t.app.viewer.title} description={t.app.viewer.intro} />
      <Suspense fallback={<LoadingBlock lines={3} />}>
        <SiteList searchParams={searchParams} />
      </Suspense>
    </PlainPage>
  );
}
