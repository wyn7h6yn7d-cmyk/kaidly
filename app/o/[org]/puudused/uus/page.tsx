import type { Metadata } from "next";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { DeficiencyForm } from "@/components/deficiencies/deficiency-form";
import { listInstallationOptions } from "@/lib/data/log";
import { t } from "@/lib/i18n";
import { installationLabel } from "@/lib/labels";
import { toLocalInput } from "@/lib/time";

export const metadata: Metadata = { title: t.app.deficiencies.newTitle };

export default function NewDeficiencyPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ paigaldis?: string }>;
}) {
  return (
    <OrgPage
      params={params}
      minRole="operator"
      render={async ({ org }) => {
        const [{ paigaldis }, installations] = await Promise.all([searchParams, listInstallationOptions(org.id)]);
        const active = installations.filter((i) => !i.archived);
        const known = active.find((i) => i.id === paigaldis);
        const back = known
          ? { href: `/o/${org.slug}/paigaldised/${known.id}/puudused`, label: known.name }
          : { href: `/o/${org.slug}/puudused`, label: t.app.deficiencies.title };
        return (
          <>
            <PageHeader eyebrow={org.name} title={t.app.deficiencies.newTitle} back={back} />
            <DeficiencyForm
              orgSlug={org.slug}
              installation={known ? { id: known.id, label: installationLabel(known) } : undefined}
              installations={active.map((i) => ({ id: i.id, label: installationLabel(i) }))}
              detectedAt={toLocalInput()}
              cancelHref={back.href}
            />
          </>
        );
      }}
    />
  );
}
