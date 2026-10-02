import type { Metadata } from "next";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { ActivityForm } from "@/components/schedule/activity-form";
import { listInstallationOptions } from "@/lib/data/log";
import { installationLabel } from "@/lib/labels";
import { todayInTallinn } from "@/lib/time";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.schedule.newTitle };
}

export default async function NewActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ paigaldis?: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      minRole="admin"
      render={async ({ org }) => {
        const [{ paigaldis }, installations] = await Promise.all([searchParams, listInstallationOptions(org.id)]);
        const active = installations.filter((i) => !i.archived);
        // Coming from an installation: the installation is known and not asked again.
        // Only an active installation of this organisation is accepted as context.
        const known = active.find((i) => i.id === paigaldis);
        const back = known
          ? { href: `/o/${org.slug}/paigaldised/${known.id}/kaidukava`, label: known.name }
          : { href: `/o/${org.slug}/kaidukava`, label: t.app.schedule.title };

        return (
          <>
            <PageHeader eyebrow={org.name} title={t.app.schedule.newTitle} back={back} />
            <ActivityForm
              orgSlug={org.slug}
              installation={known ? { id: known.id, label: installationLabel(known) } : undefined}
              installations={active.map((i) => ({ id: i.id, label: installationLabel(i) }))}
              defaultDueOn={todayInTallinn()}
              cancelHref={back.href}
            />
          </>
        );
      }}
    />
  );
}
