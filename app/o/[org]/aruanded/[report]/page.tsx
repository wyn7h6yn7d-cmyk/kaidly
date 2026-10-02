import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { ReportFilterForm } from "@/components/reports/report-filters";
import { ReportPreview } from "@/components/reports/report-preview";
import { Button } from "@/components/ui/button";
import { listInstallationOptions } from "@/lib/data/log";
import { listSites } from "@/lib/data/sites";
import { getT } from "@/lib/i18n/server";
import { buildReport } from "@/lib/reports/build";
import { filtersQuery, parseFilters } from "@/lib/reports/filters";
import { MAX_EXPORT_ROWS, PREVIEW_ROWS, REPORT_KINDS, type ReportKind, TABULAR } from "@/lib/reports/types";

type Params = Promise<{ org: string; report: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = await getT();
  const { report } = await params;
  const kind = REPORT_KINDS.find((k) => k === report);
  return { title: kind ? t.reports.types[kind].title : t.reports.title };
}

export default async function ReportPreviewPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const t = await getT();
  const { report } = await params;
  const kind = REPORT_KINDS.find((k) => k === report) as ReportKind | undefined;
  if (!kind) notFound();
  return (
    <OrgPage
      params={params}
      render={async (ctx) => {
        const { org } = ctx;
        const filters = parseFilters(await searchParams);
        const [sites, installations] = await Promise.all([listSites(org.id), listInstallationOptions(org.id)]);
        const needs = kind === "site" ? filters.site : kind === "installation" ? filters.installation : true;
        // The preview reads only the first rows; the export reads up to MAX_EXPORT_ROWS.
        const data = needs ? await buildReport(kind, ctx, t, filters, PREVIEW_ROWS) : null;
        const base = `/o/${org.slug}/aruanded/${kind}`;
        const query = filtersQuery(filters);
        const exportHref = (format: "pdf" | "csv") => `${base}/eksport?${query ? `${query}&` : ""}format=${format}`;
        const main = data?.sections.find((s) => s.kind === "table");
        return (
          <>
            <PageHeader
              eyebrow={t.reports.title}
              title={t.reports.types[kind].title}
              description={t.reports.types[kind].body}
              back={{ href: `/o/${org.slug}/aruanded`, label: t.reports.title }}
            />
            <ReportFilterForm kind={kind} filters={filters} action={base} sites={sites} installations={installations} t={t} />
            {!data ? (
              <p className="text-k-muted">{kind === "site" ? t.reports.filters.chooseSite : t.reports.filters.chooseInstallation}</p>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  {/* Plain links: the browser downloads the file; nothing is stored or shared. */}
                  <Button asChild size="lg">
                    <a href={exportHref("pdf")} download>
                      <Download aria-hidden="true" />
                      {t.reports.exportPdf}
                    </a>
                  </Button>
                  {TABULAR.includes(kind) && (
                    <Button asChild size="lg" variant="outline">
                      <a href={exportHref("csv")} download>
                        <Download aria-hidden="true" />
                        {t.reports.exportCsv}
                      </a>
                    </Button>
                  )}
                </div>
                {main && main.kind === "table" && main.total > MAX_EXPORT_ROWS && (
                  <p className="mb-4 border-l-4 border-k-warn bg-k-surface px-4 py-2 text-sm">{t.reports.truncated(MAX_EXPORT_ROWS)}</p>
                )}
                <ReportPreview report={data} t={t} />
              </>
            )}
          </>
        );
      }}
    />
  );
}
