import Link from "next/link";
import { FileText, ImageIcon } from "lucide-react";
import type { DocumentItem } from "@/lib/data/documents";
import { IMAGE_TYPES } from "@/lib/documents/rules";
import { getT } from "@/lib/i18n/server";


export function openHref(orgSlug: string, documentId: string, download = false) {
  return `/o/${orgSlug}/dokumendid/${documentId}/ava${download ? "?lae=1" : ""}`;
}

const isImage = (doc: DocumentItem) => IMAGE_TYPES.includes(doc.mimeType as never);

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
        const Icon = isImage(doc) ? ImageIcon : FileText;
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
              </p>
              {context && <p className="truncate text-sm text-k-muted">{context}</p>}
            </div>
            <a
              href={openHref(orgSlug, doc.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 shrink-0 items-center px-2 font-semibold text-k-green underline underline-offset-4"
              aria-label={copy.openFile(doc.originalFilename)}
            >
              {copy.open}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Attachments of a record: photos as thumbnails (each loads through the access-checked
 * route, so no URLs are signed for images nobody looks at), other files as links.
 */
export async function AttachmentGallery({ orgSlug, items }: { orgSlug: string; items: DocumentItem[] }) {
  const t = await getT();
  const copy = t.app.documents;
  const images = items.filter(isImage);
  const files = items.filter((doc) => !isImage(doc));
  return (
    <div className="grid gap-3">
      {images.length > 0 && (
        <ul aria-label={t.app.attachments.photos} className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((doc) => (
            <li key={doc.id}>
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
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && <DocumentList orgSlug={orgSlug} items={files} label={t.app.attachments.listLabel} />}
    </div>
  );
}
