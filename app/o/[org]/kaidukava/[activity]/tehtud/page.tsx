import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { ForbiddenState } from "@/components/app/states";
import { CompleteActivityForm } from "@/components/schedule/complete-form";
import { getActivity } from "@/lib/data/schedule";
import { formatDate, t } from "@/lib/i18n";
import { toLocalInput } from "@/lib/time";

export const metadata: Metadata = { title: t.app.schedule.completeTitle };

export default function CompleteActivityPage({
  params,
}: {
  params: Promise<{ org: string; activity: string }>;
}) {
  return (
    <OrgPage
      params={params}
      minRole="operator"
      render={async ({ org, user }) => {
        const { activity: id } = await params;
        const activity = await getActivity(org.id, id);
        if (!activity) notFound();
        if (activity.archivedAt || activity.nextDueOn === null) return <ForbiddenState orgSlug={org.slug} />;
        const href = `/o/${org.slug}/kaidukava/${activity.id}`;

        return (
          <>
            <PageHeader
              eyebrow={activity.title}
              title={t.app.schedule.completeTitle}
              description={t.app.schedule.completeIntro(formatDate(activity.nextDueOn))}
              back={{ href, label: activity.title }}
            />
            <CompleteActivityForm
              orgSlug={org.slug}
              activityId={activity.id}
              dueOn={activity.nextDueOn}
              title={activity.title}
              occurredAt={toLocalInput()}
              performedByName={user.fullName}
              cancelHref={href}
            />
          </>
        );
      }}
    />
  );
}
