import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { getT } from "@/lib/i18n/server";
import { REPORT_KINDS } from "@/lib/reports/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.reports.title };
}

export default async function ReportsPage({ params }: { params: Promise<{ org: string }> }) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      render={({ org }) => (
        <>
          <PageHeader eyebrow={org.name} title={t.reports.title} description={t.reports.intro} />
          <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
            {REPORT_KINDS.map((kind) => (
              <li key={kind}>
                <Link href={`/o/${org.slug}/aruanded/${kind}`} className="flex items-center gap-4 px-4 py-4 hover:bg-k-paper-2 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t.reports.types[kind].title}</span>
                    <span className="block text-sm text-k-muted">{t.reports.types[kind].body}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-k-grey" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    />
  );
}
