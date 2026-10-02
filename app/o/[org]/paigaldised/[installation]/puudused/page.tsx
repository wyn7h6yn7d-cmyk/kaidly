import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { GuidedEmptyState } from "@/components/app/guided-empty";
import { OrgPage } from "@/components/app/org-page";

import { DeficiencyList } from "@/components/deficiencies/deficiency-list";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/lib/auth/roles";
import { listInstallationDeficiencies } from "@/lib/data/deficiencies";
import { getInstallation } from "@/lib/data/sites";
import { todayInTallinn } from "@/lib/time";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.deficiencies.title };
}

export default async function InstallationDeficienciesPage({
  params,
}: {
  params: Promise<{ org: string; installation: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      render={async ({ org, role }) => {
        const { installation: id } = await params;
        const installation = await getInstallation(org.id, id);
        if (!installation) notFound();
        const { active, resolved, resolvedTotal } = await listInstallationDeficiencies(org.id, installation.id);
        const canAdd = hasRole(role, "operator") && !installation.archivedAt;
        const addHref = `/o/${org.slug}/puudused/uus?paigaldis=${installation.id}`;
        const copy = t.app.deficiencies;
        const today = todayInTallinn();

        return (
          <>
            {active.length === 0 ? (
              <GuidedEmptyState
                title={t.app.emptyStates.deficiencies.title}
                body={t.app.emptyStates.deficiencies.body}
                sequence={{ kind: "flow", items: t.app.emptyStates.deficiencies.flow }}
                sequenceLabel={t.app.emptyStates.howItWorks}
                action={canAdd ? { href: addHref, label: t.app.emptyStates.deficiencies.cta } : undefined}
                note={t.app.emptyStates.deficiencies.member}
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
                <DeficiencyList items={active} orgSlug={org.slug} today={today} />
              </>
            )}
            {resolved.length > 0 && (
              <details className="mt-8">
                <summary className="flex h-11 cursor-pointer items-center font-semibold text-k-green">
                  {copy.resolvedSection(resolvedTotal)}
                </summary>
                <div className="mt-3">
                  <DeficiencyList
                    items={resolved}
                    orgSlug={org.slug}
                    today={today}
                    label={copy.resolvedSection(resolvedTotal)}
                  />
                  {resolvedTotal > resolved.length && (
                    <p className="mt-3">
                      <Link
                        href={`/o/${org.slug}/puudused?paigaldis=${installation.id}&seis=resolved`}
                        className="inline-flex h-11 items-center font-semibold text-k-green underline underline-offset-4"
                      >
                        {t.app.dashboard.showAll(resolvedTotal)}
                      </Link>
                    </p>
                  )}
                </div>
              </details>
            )}
          </>
        );
      }}
    />
  );
}
