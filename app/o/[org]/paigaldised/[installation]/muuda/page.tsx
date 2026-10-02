import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { InstallationForm } from "@/components/sites/installation-form";
import { setInstallationArchived } from "@/lib/actions/sites";
import { getInstallation, listActiveSiteOptions } from "@/lib/data/sites";
import { getT } from "@/lib/i18n/server";


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
        const href = `/o/${org.slug}/paigaldised/${installation.id}`;
        const copy = t.app.installations;

        return (
          <>
            <h2 className="mb-6 text-xl font-bold">{copy.edit}</h2>
            <InstallationForm orgSlug={org.slug} sites={sites} installation={installation} cancelHref={href} />

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
                confirm={installation.archivedAt ? undefined : copy.archiveConfirm}
                label={installation.archivedAt ? copy.restore : copy.archive}
                size="default"
              />
            </section>
          </>
        );
      }}
    />
  );
}
