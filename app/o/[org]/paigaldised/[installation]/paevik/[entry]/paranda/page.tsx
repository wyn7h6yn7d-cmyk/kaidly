import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgPage } from "@/components/app/org-page";
import { NoticeState } from "@/components/app/states";
import { LogEntryForm } from "@/components/log/log-entry-form";
import { getLogEntry } from "@/lib/data/log";
import { getInstallation } from "@/lib/data/sites";
import { t } from "@/lib/i18n";
import { toLocalInput } from "@/lib/time";

export const metadata: Metadata = { title: t.app.log.correctionTitle };

export default function CorrectLogEntryPage({
  params,
}: {
  params: Promise<{ org: string; installation: string; entry: string }>;
}) {
  return (
    <OrgPage
      params={params}
      minRole="operator"
      render={async ({ org }) => {
        const { installation: installationId, entry: entryId } = await params;
        const installation = await getInstallation(org.id, installationId);
        if (!installation) notFound();
        if (installation.archivedAt) {
          return (
            <NoticeState
              message={t.errors.installation_archived}
              href={`/o/${org.slug}/paigaldised/${installation.id}/paevik`}
              linkLabel={t.app.log.title}
            />
          );
        }
        const entry = await getLogEntry(org.id, installation.id, entryId);
        if (!entry) notFound();
        const { current } = entry;

        return (
          <>
            <h2 className="mb-6 text-xl font-bold">{t.app.log.correctionTitle}</h2>
            <LogEntryForm
              orgSlug={org.slug}
              installationId={installation.id}
              correctionOfId={entry.id}
              defaults={{
                entryType: current.entryType,
                occurredAt: toLocalInput(new Date(current.occurredAt)),
                description: current.description,
                result: current.result,
                performedByName: current.performedByName,
              }}
              cancelHref={`/o/${org.slug}/paigaldised/${installation.id}/paevik/${entry.id}`}
            />
          </>
        );
      }}
    />
  );
}
