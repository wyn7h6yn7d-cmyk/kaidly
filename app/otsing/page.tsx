import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { LoadingBlock } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { SEARCH_GROUPS, SEARCH_PER_GROUP, searchKaidly, type SearchResults } from "@/lib/data/search";
import type { T } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.search.title };
}

type Search = Promise<{ q?: string }>;
type Item = { key: string; href: string; title: string; context: string };

const where = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");
const inst = (identifier: string | null, name: string | null) => [identifier, name].filter(Boolean).join(" ") || null;

/** Each result: a direct link to the record and enough context to tell similar ones apart. */
function items(r: SearchResults, t: T): Record<(typeof SEARCH_GROUPS)[number], Item[]> {
  const g = t.search.groups;
  const arch = (a: boolean) => (a ? ` (${t.search.archived})` : "");
  return {
    companies: r.companies.map((c) => ({ key: c.id, href: `/o/${c.slug}`, title: c.name, context: g.companies })),
    sites: r.sites.map((s) => ({
      key: s.id,
      href: `/o/${s.slug}/objektid/${s.id}`,
      title: s.name + arch(s.archived),
      context: where(s.company, s.address, g.sites),
    })),
    installations: r.installations.map((i) => ({
      key: i.id,
      href: `/o/${i.slug}/paigaldised/${i.id}`,
      title: inst(i.identifier, i.name)! + arch(i.archived),
      context: where(i.company, i.site, g.installations),
    })),
    log: r.log.map((e) => ({
      key: `${e.id}-${e.occurred_at}`,
      href: `/o/${e.slug}/paigaldised/${e.installation_id}/paevik/${e.id}`,
      title: `${t.app.log.types[e.entry_type]}: ${e.description}`,
      context: where(e.company, e.site, inst(e.identifier, e.installation), g.log, t.fmt.dateTime(e.occurred_at), e.correction ? t.search.correction : null),
    })),
    activities: r.activities.map((a) => ({
      key: a.id,
      href: `/o/${a.slug}/kaidukava/${a.id}`,
      title: a.title + arch(a.archived),
      context: where(a.company, a.site, inst(a.identifier, a.installation), g.activities, a.next_due_on ? t.fmt.date(a.next_due_on) : null),
    })),
    deficiencies: r.deficiencies.map((d) => ({
      key: d.id,
      href: `/o/${d.slug}/puudused/${d.id}`,
      title: d.title,
      context: where(d.company, d.site, inst(d.identifier, d.installation), t.app.deficiencies.severities[d.severity], t.app.deficiencies.statuses[d.status]),
    })),
    documents: r.documents.map((d) => ({
      key: d.id,
      href: `/o/${d.slug}/dokumendid/${d.id}`,
      title: d.title + arch(d.archived),
      context: where(d.company, d.site, inst(d.identifier, d.installation), d.original_filename),
    })),
  };
}

async function Results({ searchParams }: { searchParams: Search }) {
  await requireUser();
  const t = await getT();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  return (
    <>
      <form role="search" action="/otsing" method="get" className="mb-8 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="kaidly-search" className="sr-only">
          {t.search.label}
        </label>
        <input
          id="kaidly-search"
          name="q"
          type="search"
          defaultValue={q}
          autoFocus
          autoComplete="off"
          placeholder={t.search.placeholder}
          className="min-h-12 w-full min-w-0 rounded-sm border border-k-grey bg-k-surface px-4 text-base"
        />
        <Button type="submit" size="lg">
          {t.search.submit}
        </Button>
      </form>
      {q.length < 2 ? (
        <p className="text-k-muted">{q ? t.search.hint : t.search.intro}</p>
      ) : (
        <Grouped q={q} t={t} />
      )}
    </>
  );
}

async function Grouped({ q, t }: { q: string; t: T }) {
  const grouped = items(await searchKaidly(q, t), t);
  const total = SEARCH_GROUPS.reduce((n, g) => n + grouped[g].length, 0);
  if (total === 0) return <p role="status">{t.search.none(q)}</p>;
  return (
    <div>
      <p role="status" className="mb-6 text-sm text-k-muted">
        {t.search.count(total)}
        {SEARCH_GROUPS.some((g) => grouped[g].length >= SEARCH_PER_GROUP) && <> · {t.search.capped(SEARCH_PER_GROUP)}</>}
      </p>
      {SEARCH_GROUPS.filter((g) => grouped[g].length > 0).map((g) => (
        <section key={g} aria-labelledby={`search-${g}`} className="mb-8">
          <h2 id={`search-${g}`} className="mb-2 text-sm font-bold uppercase tracking-[0.08em] text-k-muted">
            {t.search.groups[g]}
          </h2>
          <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
            {grouped[g].map((item) => (
              <li key={item.key}>
                <Link href={item.href} className="block px-4 py-3 hover:bg-k-paper-2">
                  <span className="block break-words font-semibold">{item.title}</span>
                  <span className="block break-words text-sm text-k-muted">{item.context}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Search }) {
  const t = await getT();
  return (
    <PlainPage>
      <PageHeader title={t.search.title} back={{ href: "/o", label: t.app.back }} />
      <Suspense fallback={<LoadingBlock lines={4} />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </PlainPage>
  );
}
