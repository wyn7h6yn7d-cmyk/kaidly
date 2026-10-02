import type { Metadata } from "next";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { hasRole } from "@/lib/auth/roles";
import { listInstallationOptions } from "@/lib/data/log";
import { listActiveSiteOptions } from "@/lib/data/sites";
import { installationLabel } from "@/lib/labels";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.documents.uploadTitle };
}

export default async function UploadDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ paigaldis?: string; objekt?: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      minRole="operator"
      render={async ({ org, role }) => {
        const [query, installations, sites] = await Promise.all([
          searchParams,
          listInstallationOptions(org.id),
          listActiveSiteOptions(org.id),
        ]);
        const active = installations.filter((i) => !i.archived);
        const admin = hasRole(role, "admin");
        const installation = active.find((i) => i.id === query.paigaldis);
        const site = admin ? sites.find((s) => s.id === query.objekt) : undefined;
        const defaultScope = installation
          ? `inst:${installation.id}`
          : site
            ? `site:${site.id}`
            : admin
              ? "org"
              : "";
        const back = installation
          ? { href: `/o/${org.slug}/paigaldised/${installation.id}/dokumendid`, label: installation.name }
          : site
            ? { href: `/o/${org.slug}/objektid/${site.id}`, label: site.name }
            : { href: `/o/${org.slug}/dokumendid`, label: t.app.documents.title };
        return (
          <>
            <PageHeader eyebrow={org.name} title={t.app.documents.uploadTitle} back={back} />
            <DocumentUploadForm
              orgSlug={org.slug}
              canUseGeneralScopes={admin}
              sites={sites.map((s) => ({ id: s.id, label: s.name }))}
              installations={active.map((i) => ({ id: i.id, label: installationLabel(i) }))}
              defaultScope={defaultScope}
              cancelHref={back.href}
            />
          </>
        );
      }}
    />
  );
}
