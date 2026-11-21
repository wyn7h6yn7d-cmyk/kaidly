import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { InstallationForm } from "@/components/sites/installation-form";
import { deleteInstallation, setInstallationArchived } from "@/lib/actions/sites";
import { getInstallation, getInstallationRecordCounts, listActiveSiteOptions } from "@/lib/data/sites";
import { getT } from "@/lib/i18n/server";

// Reads request data (session, language cookie, params): allowed to block on navigation
// instead of claiming an instant static shell (Next 16.4 instant validation).
export const instant = false;


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.installations.edit };
}

export default async function EditInstallationPage({
  params,
}: {
  params: Promise<{ org: string; installation: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      minRole="admin"
      render={async ({ org }) => {
        const { installation: id } = await params;
        const [installation, sites] = await Promise.all([
          getInstallation(org.id, id),
          listActiveSiteOptions(org.id),
        ]);
        if (!installation) notFound();
        const counts = await getInstallationRecordCounts(org.id, installation.id);
        const warn = counts.openDeficiencies > 0 || counts.upcomingActivities > 0;
        const href = `/o/${org.slug}/paigaldised/${installation.id}`;
        const copy = t.app.installations;

        return (
          <>
            <h2 className="mb-6 text-xl font-bold">{copy.edit}</h2>
            {installation.archivedAt ? (
              <p className="max-w-2xl border-l-4 border-k-grey bg-k-surface px-4 py-3">{copy.archivedReadOnly}</p>
            ) : (
              <InstallationForm orgSlug={org.slug} sites={sites} installation={installation} cancelHref={href} />
            )}

            <section aria-labelledby="archive" className="mt-12 max-w-2xl border-t border-k-line pt-8">
              <h2 id="archive" className="text-xl font-bold">
                {installation.archivedAt ? copy.restore : copy.archive}
              </h2>
              <p className="mb-4 mt-1 text-k-muted">{copy.archiveBody}</p>
              <ConfirmForm
                action={setInstallationArchived}
                fields={{
                  orgSlug: org.slug,
                  installationId: installation.id,
                  archive: installation.archivedAt ? "false" : "true",
                }}
                confirm={
                  installation.archivedAt
                    ? undefined
                    : warn
                      ? copy.archiveWarning(counts.openDeficiencies, counts.upcomingActivities)
                      : copy.archiveConfirm
                }
                label={installation.archivedAt ? copy.restore : copy.archive}
                size="default"
              />
              {installation.archivedAt && !counts.empty && (
                <p className="mt-4">
                  <a href={`${href}/kustuta`} className="inline-flex min-h-11 items-center font-semibold text-k-danger underline underline-offset-4">
                    {copy.exportDelete}
                  </a>
                </p>
              )}
            </section>

            {counts.empty && (
              <section aria-labelledby="delete" className="mt-12 max-w-2xl border-t border-k-line pt-8" data-testid="delete-empty">
                <h2 id="delete" className="text-xl font-bold">{copy.deleteEmpty}</h2>
                <p className="mb-4 mt-1 text-k-muted">{copy.deleteEmptyBody}</p>
                <ConfirmForm
                  action={deleteInstallation}
                  fields={{ orgSlug: org.slug, installationId: installation.id }}
                  confirm={copy.deleteEmptyConfirm}
                  label={copy.deleteEmpty}
                  variant="outline"
                  size="default"
                />
              </section>
            )}
          </>
        );
      }}
    />
  );
}
