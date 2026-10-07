import Link from "next/link";
import { ExternalLink, FileText, FileX, ImageIcon, Link2 } from "lucide-react";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { deleteDocumentFile } from "@/lib/actions/documents";
import type { DocumentItem } from "@/lib/data/documents";
import { isImageType } from "@/lib/documents/rules";
import { getT } from "@/lib/i18n/server";

/** The access-checked route that opens a file uploaded earlier through a 60-second link. */
export function openHref(orgSlug: string, documentId: string, download = false) {
  return `/o/${orgSlug}/dokumendid/${documentId}/ava${download ? "?lae=1" : ""}`;
}

const isImage = (doc: DocumentItem) => isImageType(doc.mimeType);
/** A file uploaded earlier that can still be opened (not deleted). */
export const hasOpenableFile = (doc: DocumentItem) => doc.hasFile && !doc.deletedAt;

/**
 * Document register rows: the title links to the details; "Ava dokument" opens the external
 * link in a new tab; a file uploaded earlier opens through the short-lived file link.
 */
export async function DocumentList({
  orgSlug,
  items,
  label,
  contextFor,
}: {
  orgSlug: string;
  items: DocumentItem[];
  label?: string;
  contextFor?: (doc: DocumentItem) => string | null;
}) {
  const t = await getT();
  const copy = t.app.documents;
  return (
    <ul aria-label={label ?? copy.listLabel} className="divide-y divide-k-line border-y border-k-line">
      {items.map((doc) => {
        const Icon = doc.externalUrl ? Link2 : doc.deletedAt ? FileX : isImage(doc) ? ImageIcon : FileText;
        const context = contextFor?.(doc);
        return (
          <li key={doc.id} className="flex min-w-0 items-start gap-3 py-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-k-muted" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/o/${orgSlug}/dokumendid/${doc.id}`}
                className="font-semibold break-words text-k-ink underline-offset-4 hover:underline"
              >
                {doc.title}
              </Link>
              <p className="text-sm text-k-muted">
                {copy.categories[doc.category]} · {t.fmt.date(doc.createdAt)}
                {hasOpenableFile(doc) && doc.sizeBytes !== null && ` · ${copy.legacyFile} ${t.fmt.bytes(doc.sizeBytes)}`}
                {doc.archivedAt && ` · ${copy.archived}`}
                {doc.deletedAt && ` · ${t.app.fileDelete.deleted}`}
              </p>
              {context && <p className="truncate text-sm text-k-muted">{context}</p>}
            </div>
            {doc.externalUrl ? (
              <a
                href={doc.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 shrink-0 items-center gap-1.5 px-2 font-semibold text-k-green underline underline-offset-4"
                aria-label={copy.openLinkFor(doc.title)}
              >
                <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                {copy.openLink}
              </a>
            ) : (
              hasOpenableFile(doc) && (
                <a
                  href={openHref(orgSlug, doc.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 shrink-0 items-center px-2 font-semibold text-k-green underline underline-offset-4"
                  aria-label={copy.openFile(doc.originalFilename ?? doc.title)}
                >
                  {copy.open}
                </a>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Files uploaded earlier to a record (log entry, deficiency): images as thumbnails (each
 * loads through the access-checked route, so no URLs are signed for images nobody looks at),
 * other files as rows, deleted ones as a short trace. `canDelete` shows "Kustuta pilt" /
 * "Kustuta fail" (the database decides again); `back` is this page, for the notice.
 */
export async function AttachmentGallery({
  orgSlug,
  items,
  canDelete = false,
  back,
}: {
  orgSlug: string;
  items: DocumentItem[];
  canDelete?: boolean;
  back: string;
}) {
  const t = await getT();
  const copy = t.app.documents;
  const live = items.filter((doc) => !doc.deletedAt);
  const images = live.filter(isImage);
  const files = live.filter((doc) => !isImage(doc));
  const deleted = items.filter((doc) => doc.deletedAt);
  return (
    <div className="grid gap-3">
      {images.length > 0 && (
        <ul aria-label={t.app.attachments.photos} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((doc) => (
            <li key={doc.id} className="grid content-start gap-2">
              <a
                href={openHref(orgSlug, doc.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square overflow-hidden border border-k-line bg-k-surface"
                aria-label={copy.openFile(doc.originalFilename ?? doc.title)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed redirect, not optimisable */}
                <img src={openHref(orgSlug, doc.id)} alt={doc.title} loading="lazy" className="size-full object-cover" />
              </a>
              {canDelete && <DeleteFileButton orgSlug={orgSlug} doc={doc} back={back} />}
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul aria-label={t.app.attachments.listLabel} className="divide-y divide-k-line border-y border-k-line">
          {files.map((doc) => (
            <li key={doc.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <FileText className="size-5 shrink-0 text-k-muted" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <a
                  href={openHref(orgSlug, doc.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold break-words text-k-green underline underline-offset-4"
                  aria-label={copy.openFile(doc.originalFilename ?? doc.title)}
                >
                  {doc.title}
                </a>
                {doc.sizeBytes !== null && <p className="text-sm text-k-muted">{t.fmt.bytes(doc.sizeBytes)}</p>}
              </div>
              {canDelete && <DeleteFileButton orgSlug={orgSlug} doc={doc} back={back} />}
            </li>
          ))}
        </ul>
      )}
      {deleted.length > 0 && <DeletedFiles orgSlug={orgSlug} items={deleted} canDelete={canDelete} back={back} />}
    </div>
  );
}

/** "Kustuta pilt" / "Kustuta fail" with a confirmation that says it is permanent. */
export async function DeleteFileButton({
  orgSlug,
  doc,
  back,
  retry = false,
}: {
  orgSlug: string;
  doc: DocumentItem;
  back: string;
  retry?: boolean;
}) {
  const t = await getT();
  const copy = t.app.fileDelete;
  const image = isImage(doc);
  return (
    <ConfirmForm
      action={deleteDocumentFile}
      fields={{ orgSlug, documentId: doc.id, back }}
      confirm={image ? copy.confirmImage : copy.confirmFile}
      label={retry ? copy.retry : image ? copy.image : copy.file}
      pendingLabel={copy.pending}
      ariaLabel={retry ? undefined : image ? copy.imageFor(doc.title) : copy.fileFor(doc.title)}
    />
  );
}

/** Files deleted earlier: who deleted them and when. The file itself is gone. */
async function DeletedFiles({
  orgSlug,
  items,
  canDelete,
  back,
}: {
  orgSlug: string;
  items: DocumentItem[];
  canDelete: boolean;
  back: string;
}) {
  const t = await getT();
  const copy = t.app.fileDelete;
  return (
    <ul aria-label={copy.deletedListLabel} className="grid gap-2">
      {items.map((doc) => (
        <li key={doc.id} className="grid gap-2 border-l-4 border-k-line bg-k-surface px-3 py-2 text-sm">
          <p className="flex min-w-0 items-start gap-2">
            <FileX className="mt-0.5 size-4 shrink-0 text-k-muted" aria-hidden="true" />
            <span className="min-w-0 break-words">
              <span className="font-semibold">{isImage(doc) ? copy.deletedImage : copy.deleted}</span>
              {" — "}
              {copy.deletedBy(doc.deletedByName ?? "", t.fmt.dateTime(doc.deletedAt ?? ""))}
            </span>
          </p>
          {!doc.fileRemoved && canDelete && <DeleteFileButton orgSlug={orgSlug} doc={doc} back={back} retry />}
        </li>
      ))}
    </ul>
  );
}
