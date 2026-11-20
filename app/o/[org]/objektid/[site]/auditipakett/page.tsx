import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { AuditPackageForm } from "@/components/audits/package-form";
import { getSite } from "@/lib/data/sites";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.auditPackage.title };
}

/** Auditipakett for a site (every member; read-only companies too). docs/AUDITS.md */
export default async function AuditPackagePage({ params }: { params: Promise<{ org: string; site: string }> }) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      render={async ({ org }) => {
        const { site: siteId } = await params;
        const site = await getSite(org.id, siteId);
        if (!site) notFound();
        const base = `/o/${org.slug}/objektid/${site.id}`;
        return (
          <>
            <PageHeader title={t.app.auditPackage.title} description={site.name} back={{ href: base, label: site.name }} />
            <AuditPackageForm action={`${base}/auditipakett/pdf`} />
          </>
        );
      }}
    />
  );
}
