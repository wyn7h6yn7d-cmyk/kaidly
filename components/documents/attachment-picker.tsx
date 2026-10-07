"use client";

import { useEffect, useRef } from "react";
import { CircleAlert, CircleCheck, FileText, Paperclip, X } from "lucide-react";
import { useFieldId } from "@/components/forms/use-field-id";
import { ACCEPT_ATTRIBUTE } from "@/lib/documents/rules";
import { cn } from "@/lib/utils";
import type { UploadQueue } from "./use-upload-queue";
import type { T } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

/**
 * File chooser and upload list for documents (PDF, DOCX, XLSX — no images: photos are
 * linked, see PhotosLinkField). Progress is shown per file; state changes are announced
 * to screen readers through a polite live region (not every percent).
 */
export function AttachmentPicker({
  queue,
  label,
  hint,
  disabled,
  multiple = true,
}: {
  queue: UploadQueue;
  label?: string;
  hint?: string;
  disabled?: boolean;
  multiple?: boolean;
}) {
  const t = useT();
  const id = useFieldId();
  const copy = t.app.attachments;
  const inputRef = useRef<HTMLInputElement>(null);

  // A file chosen before the page became interactive (slow connection) fires no React
  // onChange: pick it up once on mount instead of silently ignoring it.
  useEffect(() => {
    const input = inputRef.current;
    if (input?.files?.length) {
      void queue.add(input.files);
      input.value = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, for a pre-hydration choice
  }, []);

  return (
    <div className="grid gap-3">
      <div>
        <label
          htmlFor={id("files")}
          className={cn(
            "inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-k-ink/80 px-4 text-[15px] font-semibold",
            "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:bg-k-ink/5",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <Paperclip className="size-[18px]" aria-hidden="true" />
          {label ?? t.app.attachments.addFiles}
          <input
            ref={inputRef}
            id={id("files")}
            type="file"
            className="sr-only"
            multiple={multiple}
            accept={ACCEPT_ATTRIBUTE}
            disabled={disabled}
            aria-describedby={`${id("files")}-hint`}
            onChange={(event) => {
              const files = event.currentTarget.files;
              if (files?.length) void queue.add(files);
              event.currentTarget.value = ""; // the same file can be chosen again
            }}
          />
        </label>
        <p id={`${id("files")}-hint`} className="mt-2 text-sm text-k-muted">
          {hint ?? t.app.attachments.hint}
        </p>
      </div>

      {queue.rejected.length > 0 && (
        <ul role="alert" className="grid gap-1 border-l-4 border-k-danger bg-k-surface px-3 py-2 text-sm">
          {queue.rejected.map((item) => (
            <li key={item.name}>
              <span className="font-semibold break-all">{item.name}</span>: {copy.problems[item.problem]}
            </li>
          ))}
        </ul>
      )}

      {queue.items.length > 0 && (
        <ul aria-label={copy.listLabel} className="grid gap-2">
          {queue.items.map((item) => (
            <li key={item.key} className="flex min-w-0 items-center gap-3 border border-k-line bg-white px-3 py-2">
              <StatusIcon status={item.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className={cn("text-sm", item.status === "failed" ? "text-k-danger" : "text-k-muted")}>
                  {t.fmt.bytes(item.size)} · {statusText(item, t)}
                </p>
                {item.status === "uploading" && (
                  <progress
                    className="mt-1 h-1.5 w-full accent-k-green"
                    max={100}
                    value={Math.round(item.progress * 100)}
                    aria-label={`${item.name}: ${copy.uploading(Math.round(item.progress * 100))}`}
                  />
                )}
              </div>
              {(item.status === "queued" || item.status === "failed") && !disabled && (
                <button
                  type="button"
                  onClick={() => queue.remove(item.key)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-k-ink/5"
                  aria-label={copy.remove(item.name)}
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {queue.announcement}
      </p>
    </div>
  );
}

function statusText(item: UploadQueue["items"][number], t: T): string {
  const copy = t.app.attachments;
  switch (item.status) {
    case "queued":
      return copy.queued;
    case "uploading":
      return copy.uploading(Math.round(item.progress * 100));
    case "done":
      return copy.done;
    case "failed":
      return item.error ?? copy.failed;
  }
}

function StatusIcon({ status }: { status: UploadQueue["items"][number]["status"] }) {
  if (status === "done") return <CircleCheck className="size-5 shrink-0 text-k-green" aria-hidden="true" />;
  if (status === "failed") return <CircleAlert className="size-5 shrink-0 text-k-danger" aria-hidden="true" />;
  return <FileText className="size-5 shrink-0 text-k-muted" aria-hidden="true" />;
}
