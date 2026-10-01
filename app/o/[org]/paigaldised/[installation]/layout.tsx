import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { InstallationTabs } from "@/components/sites/installation-tabs";
import { ArchivedBadge, StatusMark } from "@/components/sites/status-mark";
import { requireOrg } from "@/lib/data/organisations";
import { getInstallation } from "@/lib/data/sites";
import { t } from "@/lib/i18n";

async function InstallationHeader({
  params,
}: {
  params: Promise<{ org: string; installation: string }>;
}) {
  const { org: slug, installation: id } = await params;
  const { org } = await requireOrg(slug);
  const installation = await getInstallation(org.id, id);
  if (!installation) notFound();
  const base = `/o/${org.slug}/paigaldised/${installation.id}`;

  return (
    <>
      <PageHeader
        title={installation.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {installation.identifier && (
              <span className="font-mono text-sm font-semibold text-k-green">{installation.identifier}</span>
            )}
            <span>{t.app.installations.types[installation.installationType]}</span>
            {installation.archivedAt ? (
              <ArchivedBadge label={t.app.installations.archived} />
            ) : (
              <StatusMark status={installation.status} />
            )}
          </span>
        }
        back={{ href: `/o/${org.slug}/objektid/${installation.site.id}`, label: installation.site.name }}
      />
      <InstallationTabs base={base} />
    </>
  );
}

/** Header and tabs shared by all installation sections. Each page re-checks access. */
export default function InstallationLayout({
  params,
  children,
}: {
  params: Promise<{ org: string; installation: string }>;
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<div className="mb-8 h-36 animate-pulse border-b border-k-line" />}>
        <InstallationHeader params={params} />
      </Suspense>
      {children}
    </>
  );
}
