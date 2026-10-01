import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { OrgPage } from "@/components/app/org-page";
import { FilterPanel } from "@/components/app/filter-panel";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { Field } from "@/components/forms/field";
import { LogList, Pager, parsePage } from "@/components/log/log-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { hasRole } from "@/lib/auth/roles";
import { listInstallationOptions, listOrganisationLog, parseLogFilters } from "@/lib/data/log";
import { listActiveSiteOptions } from "@/lib/data/sites";
import { t } from "@/lib/i18n";
import { LOG_ENTRY_TYPES } from "@/lib/validation/log";

export const metadata: Metadata = { title: t.app.log.title };

export default function OrganisationLogPage({
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
        const query = await searchParams;
        const filters = parseLogFilters(query);
        const page = parsePage(query.lk);
        const [log, installations, sites] = await Promise.all([
          listOrganisationLog(org.id, filters, page),
          listInstallationOptions(org.id),
          listActiveSiteOptions(org.id),
        ]);
        const byId = new Map(installations.map((i) => [i.id, i]));
        const base = `/o/${org.slug}/paevik`;
        const copy = t.app.log;
        const f = copy.filters;
        const activeCount = Object.values(filters).filter(Boolean).length;
        const keep = new URLSearchParams(
          Object.entries({
            objekt: filters.siteId,
            paigaldis: filters.installationId,
            liik: filters.type,
            alates: filters.from,
            kuni: filters.to,
          }).filter((entry): entry is [string, string] => Boolean(entry[1])),
        );

        return (
          <>
            <PageHeader
              eyebrow={org.name}
              title={copy.title}
              actions={
                hasRole(role, "operator") && installations.some((i) => !i.archived) ? (
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href={`/o/${org.slug}/sissekanne`}>
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
                      {i.siteName} — {i.identifier ? `${i.identifier} ` : ""}
                      {i.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="filter-type" label={f.type}>
                <Select id="filter-type" name="liik" defaultValue={filters.type ?? ""}>
                  <option value="">{f.all}</option>
                  {LOG_ENTRY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {copy.types[type]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="filter-from" label={f.from}>
                <Input id="filter-from" name="alates" type="date" defaultValue={filters.from ?? ""} />
              </Field>
              <Field id="filter-to" label={f.to}>
                <Input id="filter-to" name="kuni" type="date" defaultValue={filters.to ?? ""} />
              </Field>
            </FilterPanel>

            {log.items.length === 0 ? (
              activeCount > 0 ? (
                <p className="text-k-muted">{copy.noResults}</p>
              ) : (
                <EmptyState title={copy.empty} />
              )
            ) : (
              <>
                <LogList
                  items={log.items}
                  hrefFor={(item) => `/o/${org.slug}/paigaldised/${item.installationId}/paevik/${item.id}`}
                  contextFor={(item) => {
                    const i = byId.get(item.installationId);
                    return i ? `${i.siteName} · ${i.identifier ? `${i.identifier} ` : ""}${i.name}` : null;
                  }}
                />
                <Pager
                  page={log.page}
                  hasMore={log.hasMore}
                  hrefFor={(p) => {
                    const params = new URLSearchParams(keep);
                    params.set("lk", String(p));
                    return `${base}?${params}`;
                  }}
                />
              </>
            )}
          </>
        );
      }}
    />
  );
}
