import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { DetailList } from "@/components/app/detail-list";
import { AttachmentUploader } from "@/components/documents/attachment-uploader";
import { AttachmentGallery } from "@/components/documents/document-list";
import { PhotosLink } from "@/components/documents/photos-link";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { SeverityMark, StatusBadge } from "@/components/deficiencies/marks";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { setDeficiencyStatus } from "@/lib/actions/deficiencies";
import { hasRole } from "@/lib/auth/roles";
import { getDeficiency, getResolutionEntryId, isOverdue } from "@/lib/data/deficiencies";
import { listAttachments } from "@/lib/data/documents";
import { getInstallation } from "@/lib/data/sites";
import { todayInTallinn } from "@/lib/time";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.deficiencies.title };
}

export default async function DeficiencyPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; deficiency: string }>;
  searchParams: Promise<{ lahendatud?: string; pilt?: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      render={async ({ org, role }) => {
        const [{ deficiency: id }, query] = await Promise.all([params, searchParams]);
        const deficiency = await getDeficiency(org.id, id);
        if (!deficiency) notFound();
        const [installation, resolutionEntryId, attachments] = await Promise.all([
          getInstallation(org.id, deficiency.installationId),
          deficiency.status === "resolved" ? getResolutionEntryId(org.id, deficiency.id) : Promise.resolve(null),
          listAttachments(org.id, { deficiencyId: deficiency.id }),
        ]);
        if (!installation) notFound();
        const copy = t.app.deficiencies;
        const f = copy.fields;
        const base = `/o/${org.slug}/puudused/${deficiency.id}`;
        const installationHref = `/o/${org.slug}/paigaldised/${installation.id}`;
        const canAct = hasRole(role, "operator") && deficiency.status !== "resolved";
        const overdue = isOverdue(deficiency, todayInTallinn());

        return (
          <>
            <PageHeader
              eyebrow={
                <Link href={installationHref} className="hover:text-k-ink">
                  {installation.site.name} · {installation.identifier ? `${installation.identifier} ` : ""}
                  {installation.name}
                </Link>
              }
              title={deficiency.title}
              description={
                <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <SeverityMark severity={deficiency.severity} />
                  <StatusBadge status={deficiency.status} />
                  {overdue && <span className="text-sm font-semibold text-k-danger">{copy.overdue}</span>}
                </span>
              }
              back={{ href: `${installationHref}/puudused`, label: installation.name }}
              actions={
                canAct ? (
                  <>
                    <Button asChild size="lg" className="w-full sm:order-last sm:w-auto">
                      <Link href={`${base}/lahenda`}>{copy.resolve}</Link>
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href={`${base}/muuda`}>
                        <Pencil aria-hidden="true" />
                        {copy.edit}
                      </Link>
                    </Button>
                    <ConfirmForm
                      action={setDeficiencyStatus}
                      fields={{
                        orgSlug: org.slug,
                        deficiencyId: deficiency.id,
                        status: deficiency.status === "open" ? "in_progress" : "open",
                      }}
                      label={deficiency.status === "open" ? copy.markInProgress : copy.markOpen}
                      size="default"
                    />
                  </>
                ) : undefined
              }
            />
            {query.lahendatud && (
              <div className="mb-6">
                <FormMessage success={copy.resolvedNotice} />
              </div>
            )}

            {deficiency.status === "resolved" && deficiency.resolvedAt && (
              <section aria-labelledby="resolution" className="mb-8 border-l-4 border-k-green bg-k-surface px-4 py-4 sm:px-5">
                <h2 id="resolution" className="font-bold">
                  {copy.fields.resolution}
                </h2>
                <p className="mt-1 whitespace-pre-line break-words">{deficiency.resolution}</p>
                <p className="mt-2 text-sm text-k-muted">
                  {f.resolvedBy}: {copy.resolvedOn(t.fmt.dateTime(deficiency.resolvedAt), deficiency.resolvedByName ?? "")}
                </p>
                {resolutionEntryId && (
                  <p className="mt-2">
                    <Link
                      href={`${installationHref}/paevik/${resolutionEntryId}`}
                      className="text-sm font-semibold text-k-green underline underline-offset-4"
                    >
                      {copy.logLink}
                    </Link>
                  </p>
                )}
              </section>
            )}

            <DetailList
              items={[
                { label: f.description, value: deficiency.description },
                { label: f.detectedAt, value: t.fmt.dateTime(deficiency.detectedAt) },
                { label: f.dueOn, value: deficiency.dueOn ? t.fmt.date(deficiency.dueOn) : null },
                { label: f.responsible, value: deficiency.responsiblePersonName },
                { label: f.recordedBy, value: deficiency.createdByName },
              ]}
            />

            <section aria-labelledby="attachments" className="mt-10">
              <h2 id="attachments" className="mb-3 text-lg font-bold">
                {t.app.attachments.photosAndFiles}
              </h2>
              {query.pilt === "kustutatud" && (
                <div className="mb-4">
                  <FormMessage success={t.app.imageDelete.done} />
                </div>
              )}
              {deficiency.photosUrl && (
                <p className="mb-4 flex flex-wrap items-center gap-x-2">
                  <span className="font-semibold">{t.app.photosLink.label}:</span>
                  <PhotosLink url={deficiency.photosUrl} />
                </p>
              )}
              {attachments.length === 0 && !deficiency.photosUrl ? (
                <p className="text-k-muted">{t.app.attachments.none}</p>
              ) : (
                <AttachmentGallery
                  orgSlug={org.slug}
                  items={attachments}
                  // Images uploaded before photo links: operator+ may delete them, also once resolved.
                  canDelete={hasRole(role, "operator")}
                  back={base}
                />
              )}
              {canAct && !installation.archivedAt && (
                <div className="mt-4">
                  <AttachmentUploader
                    orgSlug={org.slug}
                    target={{ kind: "deficiency", id: deficiency.id }}
                    label={t.app.attachments.addFiles}
                  />
                </div>
              )}
            </section>
          </>
        );
      }}
    />
  );
}
