import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailList } from "@/components/app/detail-list";
import { AttachmentUploader } from "@/components/documents/attachment-uploader";
import { AttachmentGallery } from "@/components/documents/document-list";
import { OrgPage } from "@/components/app/org-page";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/lib/auth/roles";
import { listAttachments } from "@/lib/data/documents";
import { getLogEntry, type LogEntryVersion } from "@/lib/data/log";
import { getInstallation } from "@/lib/data/sites";
import { formatDate, t } from "@/lib/i18n";
import { formatDateTime, isWithin } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: t.app.log.entryTitle };

/** Matches the database rule: the author may attach files for 24 hours after recording. */
const ATTACH_WINDOW_MS = 24 * 60 * 60 * 1000;

function Version({
  label,
  version,
  isCurrent,
}: {
  label: string;
  version: LogEntryVersion;
  isCurrent: boolean;
}) {
  const copy = t.app.log;
  return (
    <li className={cn("px-4 py-4 sm:px-5", !isCurrent && "text-k-muted")}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-k-ink">{label}</span>
        {isCurrent && (
          <span className="rounded-sm border border-k-green px-1.5 text-xs font-semibold text-k-green">
            {copy.current}
          </span>
        )}
        <span>{copy.recordedOn(formatDateTime(version.createdAt), version.createdByName)}</span>
      </p>
      {version.correctionReason && (
        <p className="mt-2 text-sm text-k-ink">
          <span className="font-semibold">{copy.reason}:</span> {version.correctionReason}
        </p>
      )}
      <p className="mt-2 text-sm">
        {formatDateTime(version.occurredAt)} · {copy.types[version.entryType]}
        {version.performedByName ? ` · ${copy.performedBy}: ${version.performedByName}` : ""}
      </p>
      <p className="mt-1 whitespace-pre-line break-words">{version.description}</p>
      {version.result && (
        <p className="mt-1 whitespace-pre-line break-words text-sm">
          {copy.fields.result}: {version.result}
        </p>
      )}
    </li>
  );
}

export default function LogEntryPage({
  params,
}: {
  params: Promise<{ org: string; installation: string; entry: string }>;
}) {
  return (
    <OrgPage
      params={params}
      render={async ({ org, role, user }) => {
        const { installation: installationId, entry: entryId } = await params;
        const installation = await getInstallation(org.id, installationId);
        if (!installation) notFound();
        const entry = await getLogEntry(org.id, installation.id, entryId);
        if (!entry) notFound();
        const copy = t.app.log;
        const { current } = entry;
        const base = `/o/${org.slug}/paigaldised/${installation.id}/paevik`;
        const canCorrect = hasRole(role, "operator") && !installation.archivedAt;
        const versions = [entry.original, ...entry.corrections];
        const attachments = await listAttachments(org.id, { logEntryIds: versions.map((v) => v.id) });
        const attachmentCopy = t.app.attachments;
        const canAttach =
          hasRole(role, "operator") &&
          !installation.archivedAt &&
          current.createdBy === user.id &&
          isWithin(current.createdAt, ATTACH_WINDOW_MS);
        const versionLabel = (versionId: string) => {
          const index = versions.findIndex((v) => v.id === versionId);
          return index === 0 ? copy.original : copy.correctionNumber(index);
        };
        const groups = versions
          .map((version) => ({ version, items: attachments.filter((a) => a.logEntryId === version.id) }))
          .filter((group) => group.items.length > 0);

        return (
          <>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold">
                {copy.entryTitle} · {formatDateTime(current.occurredAt)}
              </h2>
              {canCorrect && (
                <Button asChild variant="outline">
                  <Link href={`${base}/${entry.id}/paranda`}>{copy.correct}</Link>
                </Button>
              )}
            </div>

            {entry.corrections.length > 0 && (
              <p className="mb-6 inline-flex items-center gap-2 font-semibold">
                <span aria-hidden="true" className="size-2.5 bg-k-warn" />
                {copy.correctedOn(formatDateTime(current.createdAt), current.createdByName)}
              </p>
            )}

            <DetailList
              items={[
                ...(entry.scheduledActivityId
                  ? [
                      {
                        label: copy.linkedActivity,
                        value: (
                          <Link
                            href={`/o/${org.slug}/kaidukava/${entry.scheduledActivityId}`}
                            className="font-semibold text-k-green underline underline-offset-4"
                          >
                            {t.app.schedule.dueOnLabel(formatDate(entry.scheduledDueOn ?? ""))}
                          </Link>
                        ),
                      },
                    ]
                  : []),
                ...(entry.deficiencyId
                  ? [
                      {
                        label: copy.linkedDeficiency,
                        value: (
                          <Link
                            href={`/o/${org.slug}/puudused/${entry.deficiencyId}`}
                            className="font-semibold text-k-green underline underline-offset-4"
                          >
                            {copy.fromDeficiency}
                          </Link>
                        ),
                      },
                    ]
                  : []),
                { label: copy.fields.type, value: copy.types[current.entryType] },
                { label: copy.fields.occurredAt, value: formatDateTime(current.occurredAt) },
                { label: copy.fields.description, value: current.description },
                { label: copy.fields.result, value: current.result },
                { label: copy.performedBy, value: current.performedByName },
                {
                  label: copy.recordedBy,
                  value: copy.recordedOn(formatDateTime(entry.original.createdAt), entry.original.createdByName),
                },
              ]}
            />

            <section aria-labelledby="attachments" className="mt-10">
              <h3 id="attachments" className="mb-3 text-lg font-bold">
                {attachmentCopy.photos}
              </h3>
              {groups.length === 0 && <p className="text-k-muted">{attachmentCopy.none}</p>}
              <div className="grid gap-5">
                {groups.map((group) => (
                  <div key={group.version.id}>
                    {entry.corrections.length > 0 && (
                      <p className="mb-2 text-sm font-semibold">{versionLabel(group.version.id)}</p>
                    )}
                    <AttachmentGallery orgSlug={org.slug} items={group.items} />
                  </div>
                ))}
              </div>
              {canAttach ? (
                <div className="mt-4">
                  <AttachmentUploader
                    orgSlug={org.slug}
                    target={{ kind: "logEntry", id: current.id }}
                    label={attachmentCopy.addPhotos}
                    hint={`${attachmentCopy.hint} ${attachmentCopy.entryClosedHint}`}
                  />
                </div>
              ) : (
                canCorrect && <p className="mt-3 text-sm text-k-muted">{attachmentCopy.entryClosedHint}</p>
              )}
            </section>

            {entry.corrections.length > 0 && (
              <section aria-labelledby="history" className="mt-10">
                <h3 id="history" className="text-lg font-bold">
                  {copy.history}
                </h3>
                <p className="mb-4 mt-1 text-sm text-k-muted">{copy.historyIntro}</p>
                <ol className="divide-y divide-k-line border border-k-line bg-k-surface">
                  {[...versions].reverse().map((version, i) => {
                    const index = versions.length - 1 - i;
                    return (
                      <Version
                        key={version.id}
                        label={index === 0 ? copy.original : copy.correctionNumber(index)}
                        version={version}
                        isCurrent={index === versions.length - 1}
                      />
                    );
                  })}
                </ol>
              </section>
            )}

            <p className="mt-8">
              <Link href={base} className="font-semibold text-k-green underline underline-offset-4">
                {t.app.back}
              </Link>
            </p>
          </>
        );
      }}
    />
  );
}
