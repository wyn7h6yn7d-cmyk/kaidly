import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { NoticeState } from "@/components/app/states";
import { CompleteActivityForm } from "@/components/schedule/complete-form";
import { getActivity } from "@/lib/data/schedule";
import { toLocalInput } from "@/lib/time";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.schedule.completeTitle };
}

export default async function CompleteActivityPage({
  params,
}: {
  params: Promise<{ org: string; activity: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      minRole="operator"
      render={async ({ org, user }) => {
        const { activity: id } = await params;
        const activity = await getActivity(org.id, id);
        if (!activity) notFound();
        const href = `/o/${org.slug}/kaidukava/${activity.id}`;
        if (activity.archivedAt || activity.nextDueOn === null) {
          return (
            <NoticeState
              message={activity.archivedAt ? t.errors.activity_archived : t.errors.activity_already_completed}
              href={href}
              linkLabel={activity.title}
            />
          );
        }

        return (
          <>
            <PageHeader
              eyebrow={activity.title}
              title={t.app.schedule.completeTitle}
              description={t.app.schedule.completeIntro(t.fmt.date(activity.nextDueOn))}
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
