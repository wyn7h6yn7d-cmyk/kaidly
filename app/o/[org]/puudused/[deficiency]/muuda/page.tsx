import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { NoticeState } from "@/components/app/states";
import { DeficiencyForm } from "@/components/deficiencies/deficiency-form";
import { getDeficiency } from "@/lib/data/deficiencies";
import { getInstallation } from "@/lib/data/sites";
import { installationLabel } from "@/lib/labels";
import { toLocalInput } from "@/lib/time";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.deficiencies.edit };
}

export default async function EditDeficiencyPage({
  params,
}: {
  params: Promise<{ org: string; deficiency: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      minRole="operator"
      render={async ({ org }) => {
        const { deficiency: id } = await params;
        const deficiency = await getDeficiency(org.id, id);
        if (!deficiency) notFound();
        if (deficiency.status === "resolved") {
          return (
            <NoticeState
              message={t.errors.deficiency_resolved}
              href={`/o/${org.slug}/puudused/${deficiency.id}`}
              linkLabel={deficiency.title}
            />
          );
        }
        const installation = await getInstallation(org.id, deficiency.installationId);
        if (!installation) notFound();
        const href = `/o/${org.slug}/puudused/${deficiency.id}`;
        return (
          <>
            <PageHeader eyebrow={deficiency.title} title={t.app.deficiencies.edit} back={{ href, label: deficiency.title }} />
            <DeficiencyForm
              orgSlug={org.slug}
              installation={{
                id: installation.id,
                label: installationLabel({ ...installation, siteName: installation.site.name }),
              }}
              deficiency={deficiency}
              detectedAt={toLocalInput()}
              cancelHref={href}
            />
          </>
        );
      }}
    />
  );
}
