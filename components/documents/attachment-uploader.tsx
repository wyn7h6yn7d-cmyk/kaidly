"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { UploadTarget } from "@/lib/actions/documents";
import { AttachmentPicker } from "./attachment-picker";
import { useUploadQueue } from "./use-upload-queue";
import { useT } from "@/lib/i18n/client";

/**
 * Adds files to an existing record (a deficiency, or the user's own fresh log entry):
 * chosen files upload right away; the page refreshes when they are done.
 */
export function AttachmentUploader({
  orgSlug,
  target,
  label,
  hint,
}: {
  orgSlug: string;
  target: UploadTarget;
  label?: string;
  hint?: string;
}) {
  const t = useT();
  const router = useRouter();
  const queue = useUploadQueue({ orgSlug });
  const running = useRef(false);
  const { items, uploadAll, clear } = queue;
  const waiting = items.some((item) => item.status === "queued");

  useEffect(() => {
    if (!waiting || running.current) return;
    running.current = true;
    void uploadAll(target).then((allDone) => {
      running.current = false;
      if (allDone) {
        clear();
        router.refresh();
      }
    });
  }, [waiting, uploadAll, target, clear, router]);

  const failed = items.some((item) => item.status === "failed");
  return (
    <div className="grid gap-3">
      <AttachmentPicker queue={queue} label={label} hint={hint} disabled={queue.busy} />
      {failed && !queue.busy && (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              running.current = true;
              void uploadAll(target).then((allDone) => {
                running.current = false;
                if (allDone) {
                  clear();
                  router.refresh();
                }
              });
            }}
          >
            {t.app.attachments.retry}
          </Button>
        </div>
      )}
    </div>
  );
}
