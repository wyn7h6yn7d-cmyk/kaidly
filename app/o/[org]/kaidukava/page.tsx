import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FilterPanel } from "@/components/app/filter-panel";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { Field } from "@/components/forms/field";
import { Pager, pageHref, parsePage } from "@/components/log/log-list";
import { ActivityList } from "@/components/schedule/activity-list";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { hasRole } from "@/lib/auth/roles";
import { listInstallationOptions } from "@/lib/data/log";
import { listActivities, parseActivityFilters } from "@/lib/data/schedule";
import { listActiveSiteOptions } from "@/lib/data/sites";
import { installationLabel } from "@/lib/labels";
import { todayInTallinn } from "@/lib/time";
import { PRIORITIES } from "@/lib/validation/schedule";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.schedule.title };
}

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      render={async ({ org, role }) => {
        const query = await searchParams;
        const filters = parseActivityFilters(query);
        const page = parsePage(query.lk);
        const [activities, installations, sites] = await Promise.all([
          listActivities(org.id, filters, page),
          listInstallationOptions(org.id),
          listActiveSiteOptions(org.id),
        ]);
        const byId = new Map(installations.map((i) => [i.id, i]));
        const copy = t.app.schedule;
        const f = t.app.log.filters;
        const base = `/o/${org.slug}/kaidukava`;
        const isAdmin = hasRole(role, "admin");
        const activeCount = [filters.siteId, filters.installationId, filters.state, filters.priority].filter(Boolean).length;

        return (
          <>
            <PageHeader
              eyebrow={org.name}
              title={filters.archived ? `${copy.title} · ${copy.archived}` : copy.title}
              description={copy.intro}
              back={filters.archived ? { href: base, label: copy.title } : undefined}
              actions={
                isAdmin && !filters.archived ? (
                  <Button asChild>
                    <Link href={`${base}/uus`}>
                      <Plus aria-hidden="true" />
                      {copy.add}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
            {!filters.archived && (
              <FilterPanel action={base} activeCount={activeCount}>
                <Field id="filter-site" label={f.site}>
                  <Select id="filter-site" name="objekt" defaultValue={filters.siteId ?? ""}>
                    <option value="">{f.all}</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="filter-installation" label={f.installation}>
                  <Select id="filter-installation" name="paigaldis" defaultValue={filters.installationId ?? ""}>
                    <option value="">{f.all}</option>
                    {installations.map((i) => (
                      <option key={i.id} value={i.id}>
                        {installationLabel(i)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="filter-state" label={copy.filters.state}>
                  <Select id="filter-state" name="seis" defaultValue={filters.state ?? ""}>
                    <option value="">{f.all}</option>
                    {(["overdue", "soon", "upcoming", "done"] as const).map((state) => (
                      <option key={state} value={state}>
                        {copy.states[state]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="filter-priority" label={copy.filters.priority}>
                  <Select id="filter-priority" name="prioriteet" defaultValue={filters.priority ?? ""}>
                    <option value="">{f.all}</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {copy.priorities[p]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FilterPanel>
            )}

            {activities.items.length === 0 && page === 1 ? (
              activeCount > 0 || filters.archived ? (
                <p className="text-k-muted">{copy.noResults}</p>
              ) : (
                <EmptyState
                  title={copy.empty}
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
              <>
                <ActivityList
                  items={activities.items}
                  today={todayInTallinn()}
                  orgSlug={org.slug}
                  canComplete={hasRole(role, "operator")}
                  contextFor={(item) => {
                    const i = byId.get(item.installationId);
                    return i ? installationLabel(i) : null;
                  }}
                />
                <Pager
                  generic
                  page={activities.page}
                  hasMore={activities.hasMore}
                  hrefFor={(p) => pageHref(base, query, p)}
                />
              </>
            )}

            {!filters.archived && (
              <p className="mt-6">
                <Link href={`${base}?arhiiv`} className="text-sm font-semibold text-k-green underline underline-offset-4">
                  {copy.showArchived}
                </Link>
              </p>
            )}
          </>
        );
      }}
    />
  );
}
