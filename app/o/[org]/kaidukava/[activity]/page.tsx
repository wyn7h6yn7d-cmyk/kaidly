import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { DetailList } from "@/components/app/detail-list";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { FormMessage } from "@/components/forms/form-message";
import { frequencyLabel } from "@/components/schedule/activity-list";
import { DueDate, DueMark } from "@/components/schedule/due-mark";
import { Button } from "@/components/ui/button";
import { setActivityArchived } from "@/lib/actions/schedule";
import { hasRole } from "@/lib/auth/roles";
import { getActivity, listCompletions } from "@/lib/data/schedule";
import { getInstallation } from "@/lib/data/sites";
import { todayInTallinn } from "@/lib/time";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.schedule.title };
}

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; activity: string }>;
  searchParams: Promise<{ tehtud?: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      render={async ({ org, role }) => {
        const [{ activity: id }, query] = await Promise.all([params, searchParams]);
        const activity = await getActivity(org.id, id);
        if (!activity) notFound();
        const [installation, completions] = await Promise.all([
          getInstallation(org.id, activity.installationId),
          listCompletions(org.id, activity.id),
        ]);
        if (!installation) notFound();
        const copy = t.app.schedule;
        const f = copy.fields;
        const today = todayInTallinn();
        const isAdmin = hasRole(role, "admin");
        const base = `/o/${org.slug}/kaidukava/${activity.id}`;
        const installationHref = `/o/${org.slug}/paigaldised/${installation.id}`;
        const completable = hasRole(role, "operator") && activity.nextDueOn !== null && !activity.archivedAt;

        return (
          <>
            <PageHeader
              eyebrow={
                <Link href={installationHref} className="hover:text-k-ink">
                  {installation.site.name} · {installation.identifier ? `${installation.identifier} ` : ""}
                  {installation.name}
                </Link>
              }
              title={activity.title}
              description={
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <DueDate nextDueOn={activity.nextDueOn} />
                  <DueMark nextDueOn={activity.nextDueOn} today={today} />
                </span>
              }
              back={{ href: `${installationHref}/kaidukava`, label: installation.name }}
              actions={
                <>
                  {isAdmin && (
                    <Button asChild variant="outline">
                      <Link href={`${base}/muuda`}>
                        <Pencil aria-hidden="true" />
                        {copy.edit}
                      </Link>
                    </Button>
                  )}
                  {completable && (
                    <Button asChild size="lg" className="w-full sm:w-auto">
                      <Link href={`${base}/tehtud`}>{copy.complete}</Link>
                    </Button>
                  )}
                </>
              }
            />
            {query.tehtud && (
              <div className="mb-6">
                <FormMessage success={copy.completed} />
              </div>
            )}
            {activity.archivedAt && (
              <div className="mb-8 flex flex-col gap-3 border-l-4 border-k-grey bg-k-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p>{copy.archivedBanner}</p>
                {isAdmin && (
                  <ConfirmForm
                    action={setActivityArchived}
                    fields={{ orgSlug: org.slug, activityId: activity.id, archive: "false" }}
                    label={copy.restore}
                  />
                )}
              </div>
            )}

            <DetailList
              items={[
                { label: f.frequency, value: frequencyLabel(activity, t) },
                { label: f.nextDueOn, value: activity.nextDueOn ? t.fmt.date(activity.nextDueOn) : copy.states.done },
                { label: f.priority, value: copy.priorities[activity.priority] },
                {
                  label: copy.reminders.label,
                  value: activity.reminderDays.length ? copy.reminders.summary(activity.reminderDays) : copy.reminders.none,
                },
                { label: f.responsible, value: activity.responsiblePersonName },
                {
                  label: f.lastCompleted,
                  value: activity.lastCompletedAt ? t.fmt.dateTime(activity.lastCompletedAt) : f.neverCompleted,
                },
                { label: f.description, value: activity.description },
              ]}
            />

            <section aria-labelledby="completions" className="mt-10">
              <h2 id="completions" className="mb-4 text-xl font-bold">
                {copy.history}
              </h2>
              {completions.length === 0 ? (
                <p className="text-k-muted">{copy.historyEmpty}</p>
              ) : (
                <ol className="divide-y divide-k-line border border-k-line bg-k-surface">
                  {completions.map((c) => (
                    <li key={c.entryId}>
                      <Link
                        href={`${installationHref}/paevik/${c.entryId}`}
                        className="block px-4 py-3 hover:bg-k-paper-2 sm:px-5"
                      >
                        <span className="block font-semibold tabular-nums">
                          {t.fmt.dateTime(c.occurredAt)}{" "}
                          <span className="font-normal text-k-muted">({copy.dueOnLabel(t.fmt.date(c.dueOn))})</span>
                        </span>
                        <span className="block break-words">{c.description}</span>
                        <span className="block text-sm text-k-muted">
                          {c.result ? `${t.app.log.fields.result}: ${c.result} · ` : ""}
                          {t.app.log.recordedBy}: {c.recordedByName}
                          {c.isCorrected ? ` · ${t.app.log.corrected}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        );
      }}
    />
  );
}
