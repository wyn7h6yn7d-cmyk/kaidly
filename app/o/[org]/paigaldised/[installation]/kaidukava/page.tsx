import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { GuidedEmptyState } from "@/components/app/guided-empty";
import { OrgPage } from "@/components/app/org-page";
import { Pager, parsePage } from "@/components/log/log-list";

import { ActivityList } from "@/components/schedule/activity-list";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/lib/auth/roles";
import { listActivities } from "@/lib/data/schedule";
import { getInstallation } from "@/lib/data/sites";
import { todayInTallinn } from "@/lib/time";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.schedule.title };
}

export default async function InstallationSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; installation: string }>;
  searchParams: Promise<{ lk?: string }>;
}) {
  const t = await getT();
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
          <GuidedEmptyState
            title={t.app.emptyStates.schedule.title}
            body={t.app.emptyStates.schedule.body}
            sequence={{ kind: "flow", items: t.app.emptyStates.schedule.flow }}
            sequenceLabel={t.app.emptyStates.howItWorks}
            action={canAdd ? { href: addHref, label: t.app.emptyStates.schedule.cta } : undefined}
            note={t.app.emptyStates.schedule.member}
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
