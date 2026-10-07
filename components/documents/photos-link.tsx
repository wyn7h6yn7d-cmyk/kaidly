"use client";

import { ExternalLink } from "lucide-react";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";
import { linkHost } from "@/lib/external-links";

/** "Fotode link": optional https link to a folder or album where the photos are kept. */
export function PhotosLinkField({
  id,
  defaultValue,
  invalid,
}: {
  id: string;
  defaultValue?: string | null;
  invalid?: boolean;
}) {
  const t = useT();
  const copy = t.app.photosLink;
  return (
    <Field id={id} label={copy.label} hint={copy.hint} optional>
      <Input
        id={id}
        name="photosUrl"
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        maxLength={2000}
        placeholder="https://..."
        defaultValue={defaultValue ?? ""}
        aria-describedby={`${id}-hint`}
        aria-invalid={invalid}
      />
    </Field>
  );
}

/** "Dokumendi link": the external document or its folder (required for new documents). */
export function DocumentLinkField({
  id,
  defaultValue,
  invalid,
  required = false,
}: {
  id: string;
  defaultValue?: string | null;
  invalid?: boolean;
  required?: boolean;
}) {
  const t = useT();
  const copy = t.app.documents.link;
  return (
    <Field id={id} label={copy.label} hint={copy.hint} optional={!required}>
      <Input
        id={id}
        name="externalUrl"
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        maxLength={2000}
        required={required}
        placeholder="https://..."
        defaultValue={defaultValue ?? ""}
        aria-describedby={`${id}-hint`}
        aria-invalid={invalid}
      />
    </Field>
  );
}

/**
 * A saved photo link: "Ava link" plus the host, never the long raw URL. Opens in a new tab
 * without passing the page (noopener) or the KAIDLY address (noreferrer) to the other site.
 */
export function PhotosLink({ url }: { url: string }) {
  const t = useT();
  const host = linkHost(url);
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-k-green underline underline-offset-4"
        aria-label={t.app.photosLink.openLabel(host)}
      >
        <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
        {t.app.photosLink.open}
      </a>
      {host && <span className="break-all text-sm text-k-muted">{host}</span>}
    </span>
  );
}
