import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FilterPanel } from "@/components/app/filter-panel";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { DeficiencyList } from "@/components/deficiencies/deficiency-list";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { hasRole } from "@/lib/auth/roles";
import { listDeficiencies, parseDeficiencyFilters } from "@/lib/data/deficiencies";
import { listInstallationOptions } from "@/lib/data/log";
import { listActiveSiteOptions } from "@/lib/data/sites";
import { t } from "@/lib/i18n";
import { installationLabel } from "@/lib/labels";
import { todayInTallinn } from "@/lib/time";
import { DEFICIENCY_STATUSES, SEVERITIES } from "@/lib/validation/deficiencies";

export const metadata: Metadata = { title: t.app.deficiencies.title };

export default function DeficienciesPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <OrgPage
      params={params}
      render={async ({ org, role }) => {
        const filters = parseDeficiencyFilters(await searchParams);
        const [deficiencies, installations, sites] = await Promise.all([
          listDeficiencies(org.id, filters),
          listInstallationOptions(org.id),
          listActiveSiteOptions(org.id),
        ]);
        const byId = new Map(installations.map((i) => [i.id, i]));
        const copy = t.app.deficiencies;
        const f = t.app.log.filters;
        const base = `/o/${org.slug}/puudused`;
        const canAdd = hasRole(role, "operator");
        const activeCount = [filters.siteId, filters.installationId, filters.status, filters.severity, filters.overdue].filter(Boolean).length;

        return (
          <>
            <PageHeader
              eyebrow={org.name}
              title={copy.title}
              description={copy.intro}
              actions={
                canAdd ? (
                  <Button asChild>
                    <Link href={`${base}/uus`}>
                      <Plus aria-hidden="true" />
                      {copy.add}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
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
              <Field id="filter-status" label={copy.filters.status}>
                <Select id="filter-status" name="seis" defaultValue={filters.status ?? ""}>
                  <option value="">{copy.filters.active}</option>
                  {DEFICIENCY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {copy.statuses[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="filter-severity" label={copy.filters.severity}>
                <Select id="filter-severity" name="raskus" defaultValue={filters.severity ?? ""}>
                  <option value="">{f.all}</option>
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {copy.severities[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex h-11 items-center gap-3 self-end text-[15px]">
                <input
                  type="checkbox"
                  name="tahtaeg"
                  value="uletatud"
                  defaultChecked={filters.overdue}
                  className="size-5 accent-k-green"
                />
                {copy.filters.overdue}
              </label>
            </FilterPanel>

            {deficiencies.length === 0 ? (
              activeCount > 0 ? (
                <p className="text-k-muted">{copy.noResults}</p>
              ) : (
                <EmptyState title={copy.emptyActive} />
              )
            ) : (
              <DeficiencyList
                items={deficiencies}
                orgSlug={org.slug}
                today={todayInTallinn()}
                contextFor={(item) => {
                  const i = byId.get(item.installationId);
                  return i ? installationLabel(i) : null;
                }}
              />
            )}
          </>
        );
      }}
    />
  );
}
