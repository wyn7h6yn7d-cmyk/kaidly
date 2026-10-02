import type { Metadata } from "next";
import Link from "next/link";
import { FilterPanel } from "@/components/app/filter-panel";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { Field } from "@/components/forms/field";
import { Pager, pageHref, parsePage } from "@/components/log/log-list";
import { SettingsTabs } from "@/components/organisations/settings-tabs";
import { Select } from "@/components/ui/select";
import { listHistory, parseHistoryArea, type HistoryItem } from "@/lib/data/history";
import { AREA_BY_TABLE, historyHref, type HistoryEvent } from "@/lib/history";
import type { T } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.history.title };
}

function sentence(event: HistoryEvent, t: T, person: (id: string | null) => string): string {
  const h = t.app.history;
  const e = h.events;
  const area = h.areas[event.area];
  switch (event.kind) {
    case "created":
    case "archived":
    case "restored":
      return e[event.kind](area, event.name ?? h.untitled);
    case "uploaded":
      return e.uploaded(event.name ?? h.untitled);
    case "changed":
      return e.changed(area, event.name ?? h.untitled, event.fields.map((f) => h.fields[f]).join(", "));
    case "status":
      return e.status(
        event.name ?? h.untitled,
        t.app.deficiencies.statuses[event.from as keyof typeof t.app.deficiencies.statuses] ?? event.from,
        t.app.deficiencies.statuses[event.to as keyof typeof t.app.deficiencies.statuses] ?? event.to,
      );
    case "rescheduled":
      return e.rescheduled(
        event.name ?? h.untitled,
        event.from ? t.fmt.date(event.from) : h.none,
        event.to ? t.fmt.date(event.to) : h.none,
      );
    case "memberAdded":
    case "memberRemoved":
      return e[event.kind](person(event.userId), t.roles[event.role as keyof typeof t.roles] ?? event.role);
    case "roleChanged":
      return e.roleChanged(
        person(event.userId),
        t.roles[event.from as keyof typeof t.roles] ?? event.from,
        t.roles[event.to as keyof typeof t.roles] ?? event.to,
      );
    case "invited":
      return e.invited(event.email, t.roles[event.role as keyof typeof t.roles] ?? event.role);
    case "invitationRevoked":
    case "invitationAccepted":
      return e[event.kind](event.email);
  }
}

/**
 * Read-only change history for owners and admins: traceability, not analytics. The
 * database decides who may read it (RLS: admin+ of this organisation).
 */
export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <OrgPage
      params={params}
      minRole="admin"
      readable
      render={async ({ org }) => {
        const [t, query] = await Promise.all([getT(), searchParams]);
        const area = parseHistoryArea(query.ala);
        const page = parsePage(query.lk);
        const history = await listHistory(org.id, area, page);
        const h = t.app.history;
        const base = `/o/${org.slug}/seaded/ajalugu`;
        const person = (id: string | null) => (id ? history.names.get(id) || h.unknownPerson : h.system);
        const areas = [...new Set(Object.values(AREA_BY_TABLE))];

        return (
          <>
            <PageHeader eyebrow={org.name} title={t.app.settings.title} />
            <SettingsTabs orgSlug={org.slug} active="history" showHistory />
            <p className="k-measure mb-6 text-k-muted">{h.intro}</p>
            <FilterPanel action={base} activeCount={area ? 1 : 0}>
              <Field id="filter-area" label={h.area}>
                <Select id="filter-area" name="ala" defaultValue={area ?? ""}>
                  <option value="">{h.all}</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {h.areas[a]}
                    </option>
                  ))}
                </Select>
              </Field>
            </FilterPanel>

            {history.items.length === 0 && page === 1 ? (
              area ? <p className="text-k-muted">{h.noResults}</p> : <EmptyState title={h.empty} />
            ) : (
              <>
                <ol aria-label={h.listLabel} className="divide-y divide-k-line border-y border-k-line">
                  {history.items.map((item: HistoryItem) => {
                    const href = historyHref(org.slug, item.table, item.recordId);
                    const text = sentence(item.event, t, person);
                    return (
                      <li key={item.id} className="grid gap-1 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
                        <div className="text-sm text-k-muted">
                          <time dateTime={item.at} className="block font-semibold tabular-nums text-k-ink">
                            {t.fmt.dateTime(item.at)}
                          </time>
                          {person(item.actorId)}
                        </div>
                        <div className="min-w-0">
                          <p className="break-words">{text}</p>
                          {href && (
                            <Link
                              href={href}
                              aria-label={`${h.open}: ${text}`}
                              className="mt-1 inline-flex h-11 items-center text-sm font-semibold text-k-green underline underline-offset-4 sm:h-auto"
                            >
                              {h.open}
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <Pager generic page={history.page} hasMore={history.hasMore} hrefFor={(p) => pageHref(base, query, p)} />
              </>
            )}
          </>
        );
      }}
    />
  );
}
