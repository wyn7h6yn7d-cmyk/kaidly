import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { DetailList } from "@/components/app/detail-list";
import { OrgPage } from "@/components/app/org-page";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { StatusMark } from "@/components/sites/status-mark";
import { Button } from "@/components/ui/button";
import { setInstallationArchived } from "@/lib/actions/sites";
import { hasRole } from "@/lib/auth/roles";
import { getInstallation } from "@/lib/data/sites";
import { formatDate, t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.app.installations.tabs.overview };

export default function InstallationOverviewPage({
  params,
}: {
  params: Promise<{ org: string; installation: string }>;
}) {
  return (
    <OrgPage
      params={params}
      render={async ({ org, role }) => {
        const { installation: id } = await params;
        const installation = await getInstallation(org.id, id);
        if (!installation) notFound();
        const f = t.app.installations.fields;
        const isAdmin = hasRole(role, "admin");

        return (
          <>
            {installation.archivedAt && (
              <div className="mb-8 flex flex-col gap-3 border-l-4 border-k-grey bg-k-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p>{t.app.installations.archivedBanner}</p>
                {isAdmin && (
                  <ConfirmForm
                    action={setInstallationArchived}
                    fields={{ orgSlug: org.slug, installationId: installation.id, archive: "false" }}
                    label={t.app.installations.restore}
                  />
                )}
              </div>
            )}

            <DetailList
              items={[
                { label: f.site, value: installation.site.name },
                { label: f.identifier, value: installation.identifier },
                { label: f.type, value: t.app.installations.types[installation.installationType] },
                { label: f.status, value: <StatusMark status={installation.status} /> },
                { label: f.location, value: installation.location },
                {
                  label: f.commissionedOn,
                  value: installation.commissionedOn ? formatDate(installation.commissionedOn) : null,
                },
                { label: f.responsiblePerson, value: installation.responsiblePerson },
                { label: f.description, value: installation.description },
                { label: f.notes, value: installation.notes },
              ]}
            />

            {isAdmin && (
              <div className="mt-8">
                <Button asChild variant="outline">
                  <Link href={`/o/${org.slug}/paigaldised/${installation.id}/muuda`}>
                    <Pencil aria-hidden="true" />
                    {t.app.installations.edit}
                  </Link>
                </Button>
              </div>
            )}
          </>
        );
      }}
    />
  );
}
