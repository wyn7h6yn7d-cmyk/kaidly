import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { OrgPage } from "@/components/app/org-page";
import { Pager, parsePage } from "@/components/log/log-list";
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
  searchParams,
}: {
  params: Promise<{ org: string; installation: string }>;
  searchParams: Promise<{ lk?: string }>;
}) {
  return (
    <OrgPage
      params={params}
      render={async ({ org, role }) => {
        const [{ installation: id }, query] = await Promise.all([params, searchParams]);
        const page = parsePage(query.lk);
        const installation = await getInstallation(org.id, id);
        if (!installation) notFound();
        const activities = await listActivities(org.id, { installationId: installation.id }, page);
        const canAdd = hasRole(role, "admin") && !installation.archivedAt;
        const addHref = `/o/${org.slug}/kaidukava/uus?paigaldis=${installation.id}`;
        const copy = t.app.schedule;

        return activities.items.length === 0 && page === 1 ? (
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
              items={activities.items}
              today={todayInTallinn()}
              orgSlug={org.slug}
              canComplete={hasRole(role, "operator")}
            />
            <Pager
              generic
              page={activities.page}
              hasMore={activities.hasMore}
              hrefFor={(p) => `/o/${org.slug}/paigaldised/${installation.id}/kaidukava${p > 1 ? `?lk=${p}` : ""}`}
            />
          </>
        );
      }}
    />
  );
}
