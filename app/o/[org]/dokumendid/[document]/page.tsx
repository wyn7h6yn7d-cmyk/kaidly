import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { DetailList } from "@/components/app/detail-list";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { DocumentEditForm } from "@/components/documents/document-edit-form";
import { openHref } from "@/components/documents/document-list";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { Button } from "@/components/ui/button";
import { archiveDocument, restoreDocument } from "@/lib/actions/documents";
import { hasRole } from "@/lib/auth/roles";
import { getDocument, getDocumentPlacement } from "@/lib/data/documents";
import { getInstallation } from "@/lib/data/sites";
import { formatBytes } from "@/lib/documents/rules";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: t.app.documents.detailsTitle };

const linkClass = "font-semibold text-k-green underline underline-offset-4";

export default function DocumentPage({ params }: { params: Promise<{ org: string; document: string }> }) {
  return (
    <OrgPage
      params={params}
      render={async ({ org, role }) => {
        const { document: id } = await params;
        const doc = await getDocument(org.id, id);
        if (!doc) notFound();
        const [placement, installation] = await Promise.all([
          getDocumentPlacement(org.id, doc),
          doc.installationId ? getInstallation(org.id, doc.installationId) : null,
        ]);
        const copy = t.app.documents;
        const f = copy.fields;
        const historical = Boolean(doc.logEntryId || doc.deficiencyId);
        const canManage = hasRole(role, "admin") && !historical;

        const belongsTo = installation ? (
          <Link href={`/o/${org.slug}/paigaldised/${installation.id}/dokumendid`} className={linkClass}>
            {installation.site.name} — {installation.identifier ? `${installation.identifier} ` : ""}
            {installation.name}
          </Link>
        ) : doc.siteId ? (
          <Link href={`/o/${org.slug}/objektid/${doc.siteId}`} className={linkClass}>
            {placement.siteName}
          </Link>
        ) : (
          f.scopeOrganisation
        );

        return (
          <>
            <PageHeader
              eyebrow={copy.categories[doc.category]}
              title={doc.title}
              back={{ href: `/o/${org.slug}/dokumendid`, label: copy.title }}
              actions={
                <>
                  <Button asChild>
                    <a href={openHref(org.slug, doc.id)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink aria-hidden="true" />
                      {copy.open}
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={openHref(org.slug, doc.id, true)}>
                      <Download aria-hidden="true" />
                      {copy.download}
                    </a>
                  </Button>
                </>
              }
            />

            {doc.archivedAt && (
              <p className="mb-6 inline-flex items-center gap-2 font-semibold">
                <span aria-hidden="true" className="size-2.5 bg-k-grey" />
                {copy.archived} {formatDateTime(doc.archivedAt)}
              </p>
            )}
            {historical && (
              <p className="mb-6 border-l-4 border-k-green bg-k-surface px-4 py-3">{copy.historical}</p>
            )}

            <DetailList
              items={[
                { label: f.filename, value: <span className="break-all">{doc.originalFilename}</span> },
                { label: f.size, value: formatBytes(doc.sizeBytes) },
                { label: f.scope, value: belongsTo },
                ...(doc.logEntryId && installation && placement.logEntryOriginalId
                  ? [
                      {
                        label: f.attachedTo,
                        value: (
                          <Link
                            href={`/o/${org.slug}/paigaldised/${installation.id}/paevik/${placement.logEntryOriginalId}`}
                            className={linkClass}
                          >
                            {copy.linkedLogEntry}
                          </Link>
                        ),
                      },
                    ]
                  : []),
                ...(doc.deficiencyId
                  ? [
                      {
                        label: f.attachedTo,
                        value: (
                          <Link href={`/o/${org.slug}/puudused/${doc.deficiencyId}`} className={linkClass}>
                            {copy.linkedDeficiency}
                          </Link>
                        ),
                      },
                    ]
                  : []),
                { label: f.uploadedBy, value: doc.uploadedByName || null },
                { label: f.uploadedAt, value: formatDateTime(doc.createdAt) },
              ]}
            />

            {canManage && (
              <section aria-labelledby="manage" className="mt-10 grid gap-6 border-t border-k-line pt-6">
                <h2 id="manage" className="text-lg font-bold">
                  {copy.edit}
                </h2>
                {!doc.archivedAt && (
                  <DocumentEditForm orgSlug={org.slug} documentId={doc.id} title={doc.title} category={doc.category} />
                )}
                {doc.archivedAt ? (
                  <ConfirmForm
                    action={restoreDocument}
                    fields={{ orgSlug: org.slug, documentId: doc.id }}
                    label={copy.restore}
                  />
                ) : (
                  <div>
                    <p className="mb-3 max-w-xl text-sm text-k-muted">{copy.archiveConfirm}</p>
                    <ConfirmForm
                      action={archiveDocument}
                      fields={{ orgSlug: org.slug, documentId: doc.id }}
                      confirm={copy.archiveConfirm}
                      label={copy.archive}
                    />
                  </div>
                )}
              </section>
            )}
          </>
        );
      }}
    />
  );
}
