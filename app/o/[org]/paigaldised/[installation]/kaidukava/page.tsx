import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { OrgPage } from "@/components/app/org-page";
import { EmptyState } from "@/components/app/states";
import { ActivityList } from "@/components/schedule/activity-list";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/lib/auth/roles";
import { listActivities } from "@/lib/data/schedule";
import { getInstallation } from "@/lib/data/sites";
import { t } from "@/lib/i18n";
import { todayInTallinn } from "@/lib/time";

export const metadata: Metadata = { title: t.app.schedule.title };

export default function InstallationSchedulePage({
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
        const activities = await listActivities(org.id, { installationId: installation.id });
        const canAdd = hasRole(role, "admin") && !installation.archivedAt;
        const addHref = `/o/${org.slug}/kaidukava/uus?paigaldis=${installation.id}`;
        const copy = t.app.schedule;

        return activities.length === 0 ? (
          <EmptyState
            title={copy.empty}
            body={canAdd ? copy.emptyAdmin : copy.emptyMember}
            action={
              canAdd ? (
                <Button asChild>
                  <Link href={addHref}>
                    <Plus aria-hidden="true" />
                    {copy.add}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {canAdd && (
              <div className="mb-4 flex justify-end">
                <Button asChild variant="outline">
                  <Link href={addHref}>
                    <Plus aria-hidden="true" />
                    {copy.add}
                  </Link>
                </Button>
              </div>
            )}
            <ActivityList
              items={activities}
              today={todayInTallinn()}
              orgSlug={org.slug}
              canComplete={hasRole(role, "operator")}
            />
          </>
        );
      }}
    />
  );
}
