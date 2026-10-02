import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, FilePlus, Pencil, Plus, TriangleAlert } from "lucide-react";
import { DetailList } from "@/components/app/detail-list";
import { OrgPage } from "@/components/app/org-page";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { StatusMark } from "@/components/sites/status-mark";
import { Button } from "@/components/ui/button";
import { setInstallationArchived } from "@/lib/actions/sites";
import { hasRole } from "@/lib/auth/roles";
import { getInstallationSummary } from "@/lib/data/dashboard";
import { getInstallation } from "@/lib/data/sites";
import { getT } from "@/lib/i18n/server";



export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.installations.tabs.overview };
}

export default async function InstallationOverviewPage({
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
        const f = t.app.installations.fields;
        const isAdmin = hasRole(role, "admin");
        const canWrite = hasRole(role, "operator") && !installation.archivedAt;
        const summary = await getInstallationSummary(org.id, installation.id);
        const base = `/o/${org.slug}/paigaldised/${installation.id}`;
        const s = t.app.installationSummary;
        const linkClass = "font-semibold text-k-green underline underline-offset-4";

        return (
          <>
            {installation.archivedAt && (
              <div className="mb-8 flex flex-col gap-3 border-l-4 border-k-grey bg-k-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p>{t.app.installations.archivedBanner}</p>
                {isAdmin && (
                  <ConfirmForm
                    action={setInstallationArchived}
                    fields={{ orgSlug: org.slug, installationId: installation.id, archive: "false" }}
                    label={t.app.installations.restore}
                  />
                )}
              </div>
            )}

            {summary.lastEntry === null ? (
              <section aria-labelledby="first-entry" className="mb-8 border-l-4 border-k-volt bg-k-surface px-4 py-4 sm:px-5">
                <h2 id="first-entry" className="font-bold">
                  {s.firstEntryTitle}
                </h2>
                {canWrite && (
                  <>
                    <p className="mt-1 max-w-xl text-k-muted">{s.firstEntryBody}</p>
                    <Button asChild size="lg" className="mt-4">
                      <Link href={`${base}/paevik/uus`}>
                        <Plus aria-hidden="true" />
                        {t.app.log.addFirst}
                      </Link>
                    </Button>
                  </>
                )}
              </section>
            ) : (
              <section aria-label={s.label} className="mb-8 grid gap-1 border-l-4 border-k-line bg-k-surface px-4 py-3 text-sm sm:px-5">
                <p>
                  <span className="font-semibold">{s.lastEntry}:</span>{" "}
                  <Link href={`${base}/paevik/${summary.lastEntry.id}`} className={linkClass}>
                    {t.fmt.dateTime(summary.lastEntry.occurredAt)} · {t.app.log.types[summary.lastEntry.entryType]}
                  </Link>
                </p>
                <p>
                  {summary.overdueActivities > 0 ? (
                    <Link href={`${base}/kaidukava`} className={linkClass}>
                      {s.overdue(summary.overdueActivities)}
                    </Link>
                  ) : (
                    s.noOverdue
                  )}
                  {" · "}
                  {summary.openDeficiencies > 0 ? (
                    <Link href={`${base}/puudused`} className={linkClass}>
                      {s.open(summary.openDeficiencies)}
                    </Link>
                  ) : (
                    s.noOpen
                  )}
                </p>
              </section>
            )}

            {canWrite && (
              <section aria-labelledby="quick-actions" className="mb-8">
                <h2 id="quick-actions" className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-k-muted">
                  {s.quickTitle}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/o/${org.slug}/puudused/uus?paigaldis=${installation.id}`}>
                      <TriangleAlert aria-hidden="true" />
                      {s.quickDeficiency}
                    </Link>
                  </Button>
                  {isAdmin && (
                    <Button asChild variant="outline">
                      <Link href={`/o/${org.slug}/kaidukava/uus?paigaldis=${installation.id}`}>
                        <CalendarPlus aria-hidden="true" />
                        {s.quickActivity}
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline">
                    <Link href={`/o/${org.slug}/dokumendid/uus?paigaldis=${installation.id}`}>
                      <FilePlus aria-hidden="true" />
                      {s.quickDocument}
                    </Link>
                  </Button>
                </div>
              </section>
            )}

            <DetailList
              items={[
                { label: f.site, value: installation.site.name },
                { label: f.identifier, value: installation.identifier },
                { label: f.type, value: t.app.installations.types[installation.installationType] },
                { label: f.status, value: <StatusMark status={installation.status} /> },
                { label: f.location, value: installation.location },
                {
                  label: f.commissionedOn,
                  value: installation.commissionedOn ? t.fmt.date(installation.commissionedOn) : null,
                },
                { label: f.responsiblePerson, value: installation.responsiblePerson },
                { label: f.description, value: installation.description },
                { label: f.notes, value: installation.notes },
              ]}
            />

            {isAdmin && (
              <div className="mt-8">
                <Button asChild variant="outline">
                  <Link href={`${base}/muuda`}>
                    <Pencil aria-hidden="true" />
                    {t.app.installations.edit}
                  </Link>
                </Button>
              </div>
            )}
          </>
        );
      }}
    />
  );
}
