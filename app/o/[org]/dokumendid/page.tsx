import type { Metadata } from "next";
import Link from "next/link";
import { Upload } from "lucide-react";
import { FilterPanel } from "@/components/app/filter-panel";
import { GuidedEmptyState } from "@/components/app/guided-empty";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";

import { DocumentList } from "@/components/documents/document-list";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { Pager, parsePage } from "@/components/log/log-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { hasRole } from "@/lib/auth/roles";
import { listDocuments, parseDocumentFilters } from "@/lib/data/documents";
import { listInstallationOptions } from "@/lib/data/log";
import { listActiveSiteOptions } from "@/lib/data/sites";
import { DOCUMENT_CATEGORIES } from "@/lib/documents/rules";
import { installationLabel } from "@/lib/labels";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.documents.title };
}

export default async function DocumentsPage({
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
        const filters = parseDocumentFilters(query);
        const page = parsePage(query.lk);
        const [documents, installations, sites] = await Promise.all([
          listDocuments(org.id, filters, page),
          listInstallationOptions(org.id),
          listActiveSiteOptions(org.id),
        ]);
        const installationsById = new Map(installations.map((i) => [i.id, i]));
        const sitesById = new Map(sites.map((s) => [s.id, s.name]));
        const base = `/o/${org.slug}/dokumendid`;
        const copy = t.app.documents;
        const f = t.app.log.filters;
        const { archived, ...narrowing } = filters;
        const activeCount = Object.values(narrowing).filter(Boolean).length;
        const keep = new URLSearchParams(
          Object.entries({
            objekt: filters.siteId,
            paigaldis: filters.installationId,
            liik: filters.category,
            alates: filters.from,
            kuni: filters.to,
            arhiiv: archived ? "1" : undefined,
          }).filter((entry): entry is [string, string] => Boolean(entry[1])),
        );
        const canUpload = hasRole(role, "operator");
        const uploadButton = canUpload ? (
          <Button asChild>
            <Link href={`${base}/uus`}>
              <Upload aria-hidden="true" />
              {copy.upload}
            </Link>
          </Button>
        ) : undefined;

        return (
          <>
            <PageHeader
              eyebrow={org.name}
              title={archived ? copy.showArchived : copy.title}
              description={archived ? undefined : copy.intro}
              actions={archived ? undefined : uploadButton}
            />
            {query.salvestatud && (
              <div className="mb-4">
                <FormMessage success={copy.saved} />
              </div>
            )}
            <FilterPanel action={base} activeCount={activeCount}>
              {archived && <input type="hidden" name="arhiiv" value="1" />}
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
              <Field id="filter-category" label={copy.filters.category}>
                <Select id="filter-category" name="liik" defaultValue={filters.category ?? ""}>
                  <option value="">{f.all}</option>
                  {DOCUMENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {copy.categories[category]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="filter-from" label={copy.filters.from}>
                <Input id="filter-from" name="alates" type="date" defaultValue={filters.from ?? ""} />
              </Field>
              <Field id="filter-to" label={copy.filters.to}>
                <Input id="filter-to" name="kuni" type="date" defaultValue={filters.to ?? ""} />
              </Field>
            </FilterPanel>

            {documents.items.length === 0 ? (
              activeCount > 0 || archived ? (
                <p className="text-k-muted">{copy.noResults}</p>
              ) : (
                <GuidedEmptyState
                  title={t.app.emptyStates.documents.title}
                  body={t.app.emptyStates.documents.body}
                  examples={{ label: t.app.emptyStates.examples, items: t.app.emptyStates.documents.examples }}
                  action={canUpload ? { href: `${base}/uus`, label: t.app.emptyStates.documents.cta } : undefined}
                  note={t.app.emptyStates.documents.member}
                />
              )
            ) : (
              <>
                <DocumentList
                  orgSlug={org.slug}
                  items={documents.items}
                  label={archived ? copy.archivedListLabel : copy.listLabel}
                  contextFor={(doc) => {
                    const installation = doc.installationId ? installationsById.get(doc.installationId) : undefined;
                    if (installation) return installationLabel(installation);
                    if (doc.siteId) return sitesById.get(doc.siteId) ?? null;
                    return copy.fields.scopeOrganisation;
                  }}
                />
                <Pager
                  generic
                  page={documents.page}
                  hasMore={documents.hasMore}
                  hrefFor={(p) => {
                    const params = new URLSearchParams(keep);
                    params.set("lk", String(p));
                    return `${base}?${params}`;
                  }}
                />
              </>
            )}

            <p className="mt-8">
              <Link
                href={archived ? base : `${base}?arhiiv=1`}
                className="inline-flex h-11 items-center font-semibold text-k-green underline underline-offset-4"
              >
                {archived ? copy.hideArchived : copy.showArchived}
              </Link>
            </p>
          </>
        );
      }}
    />
  );
}
