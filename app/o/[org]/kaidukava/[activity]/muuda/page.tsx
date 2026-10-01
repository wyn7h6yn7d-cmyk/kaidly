import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { ActivityForm } from "@/components/schedule/activity-form";
import { setActivityArchived } from "@/lib/actions/schedule";
import { getActivity } from "@/lib/data/schedule";
import { getInstallation } from "@/lib/data/sites";
import { t } from "@/lib/i18n";
import { installationLabel } from "@/lib/labels";
import { todayInTallinn } from "@/lib/time";

export const metadata: Metadata = { title: t.app.schedule.edit };

export default function EditActivityPage({
  params,
}: {
  params: Promise<{ org: string; activity: string }>;
}) {
  return (
    <OrgPage
      params={params}
      minRole="admin"
      render={async ({ org }) => {
        const { activity: id } = await params;
        const activity = await getActivity(org.id, id);
        if (!activity) notFound();
        const installation = await getInstallation(org.id, activity.installationId);
        if (!installation) notFound();
        const href = `/o/${org.slug}/kaidukava/${activity.id}`;
        const copy = t.app.schedule;

        return (
          <>
            <PageHeader eyebrow={activity.title} title={copy.edit} back={{ href, label: activity.title }} />
            <ActivityForm
              orgSlug={org.slug}
              installation={{
                id: installation.id,
                label: installationLabel({ ...installation, siteName: installation.site.name }),
              }}
              activity={activity}
              defaultDueOn={todayInTallinn()}
              cancelHref={href}
            />
            <section aria-labelledby="archive" className="mt-12 max-w-2xl border-t border-k-line pt-8">
              <h2 id="archive" className="text-xl font-bold">
                {activity.archivedAt ? copy.restore : copy.archive}
              </h2>
              <p className="mb-4 mt-1 text-k-muted">{copy.archiveBody}</p>
              <ConfirmForm
                action={setActivityArchived}
                fields={{ orgSlug: org.slug, activityId: activity.id, archive: activity.archivedAt ? "false" : "true" }}
                confirm={activity.archivedAt ? undefined : copy.archiveConfirm}
                label={activity.archivedAt ? copy.restore : copy.archive}
                size="default"
              />
            </section>
          </>
        );
      }}
    />
  );
}
