import Link from "next/link";
import { FileText, ImageIcon, ImageOff } from "lucide-react";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { deleteDocumentImage } from "@/lib/actions/documents";
import type { DocumentItem } from "@/lib/data/documents";
import { isImageType } from "@/lib/documents/rules";
import { getT } from "@/lib/i18n/server";


export function openHref(orgSlug: string, documentId: string, download = false) {
  return `/o/${orgSlug}/dokumendid/${documentId}/ava${download ? "?lae=1" : ""}`;
}

const isImage = (doc: DocumentItem) => isImageType(doc.mimeType);

/** Document rows: title links to the details; the file opens through a short-lived link. */
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
        const Icon = doc.deletedAt ? ImageOff : isImage(doc) ? ImageIcon : FileText;
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
                {copy.categories[doc.category]} · {t.fmt.date(doc.createdAt)} · {t.fmt.bytes(doc.sizeBytes)}
                {doc.archivedAt && ` · ${copy.archived}`}
                {doc.deletedAt && ` · ${t.app.imageDelete.deleted}`}
              </p>
              {context && <p className="truncate text-sm text-k-muted">{context}</p>}
            </div>
            {!doc.deletedAt && (
              <a
                href={openHref(orgSlug, doc.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 shrink-0 items-center px-2 font-semibold text-k-green underline underline-offset-4"
                aria-label={copy.openFile(doc.originalFilename)}
              >
                {copy.open}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Attachments of a record: photos uploaded before photo links as thumbnails (each loads
 * through the access-checked route, so no URLs are signed for images nobody looks at),
 * deleted images as a short trace, other files as links. `canDelete` shows "Kustuta pilt"
 * (the database decides again); `back` is this page, for the confirmation notice.
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
  const images = items.filter((doc) => isImage(doc) && !doc.deletedAt);
  const deleted = items.filter((doc) => doc.deletedAt);
  const files = items.filter((doc) => !isImage(doc));
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
                aria-label={copy.openFile(doc.originalFilename)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed redirect, not optimisable */}
                <img
                  src={openHref(orgSlug, doc.id)}
                  alt={doc.title}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </a>
              {canDelete && <DeleteImageButton orgSlug={orgSlug} doc={doc} back={back} />}
            </li>
          ))}
        </ul>
      )}
      {deleted.length > 0 && <DeletedImages orgSlug={orgSlug} items={deleted} canDelete={canDelete} back={back} />}
      {files.length > 0 && <DocumentList orgSlug={orgSlug} items={files} label={t.app.attachments.listLabel} />}
    </div>
  );
}

/** "Kustuta pilt" with a confirmation that says it is permanent. */
export async function DeleteImageButton({
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
  const copy = t.app.imageDelete;
  return (
    <ConfirmForm
      action={deleteDocumentImage}
      fields={{ orgSlug, documentId: doc.id, back }}
      confirm={copy.confirm}
      label={retry ? copy.retry : copy.button}
      pendingLabel={copy.pending}
      ariaLabel={retry ? undefined : copy.buttonFor(doc.title)}
    />
  );
}

/** Images deleted earlier: who deleted them and when. The file is gone. */
async function DeletedImages({
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
  const copy = t.app.imageDelete;
  return (
    <ul aria-label={copy.deletedListLabel} className="grid gap-2">
      {items.map((doc) => (
        <li key={doc.id} className="grid gap-2 border-l-4 border-k-line bg-k-surface px-3 py-2 text-sm">
          <p className="flex min-w-0 items-start gap-2">
            <ImageOff className="mt-0.5 size-4 shrink-0 text-k-muted" aria-hidden="true" />
            <span className="min-w-0 break-words">
              <span className="font-semibold">{copy.deleted}</span>
              {" — "}
              {copy.deletedBy(doc.deletedByName ?? "", t.fmt.dateTime(doc.deletedAt ?? ""))}
            </span>
          </p>
          {!doc.fileRemoved && canDelete && <DeleteImageButton orgSlug={orgSlug} doc={doc} back={back} retry />}
        </li>
      ))}
    </ul>
  );
}
