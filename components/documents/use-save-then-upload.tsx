"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import type { UploadTarget } from "@/lib/actions/documents";
import type { ActionState, SavedRecord } from "@/lib/actions/state";
import { useT } from "@/lib/i18n/client";
import { useSessionDraft } from "@/components/forms/use-session-draft";
import { useUploadQueue } from "./use-upload-queue";

/**
 * Forms that create a record and attach photos to it (log entries, deficiencies). The
 * record is saved first; then the chosen files upload to it. If an upload fails the record
 * is already safe, the form keeps what was typed, and the user can retry or continue
 * without the files. One implementation for every such form.
 */
export function useSaveThenUpload(
  orgSlug: string,
  action: (state: ActionState<SavedRecord>, formData: FormData) => Promise<ActionState<SavedRecord>>,
  targetFor: (id: string) => UploadTarget,
  /** sessionStorage key for an unsaved draft; null = no draft (e.g. editing). */
  draftKey: string | null = null,
) {
  const router = useRouter();
  const draft = useSessionDraft(draftKey);
  const queue = useUploadQueue({ orgSlug, resizeImages: true });
  const [retrying, setRetrying] = useState(false);

  const save = async (previous: ActionState<SavedRecord>, formData: FormData) => {
    if (queue.items.length) formData.set("withAttachments", "1");
    // The draft is dropped as the form goes out (a redirect never comes back here) and
    // written again if saving fails, so a lost connection or reload keeps the text.
    draft.clear();
    let result: ActionState<SavedRecord>;
    try {
      result = await action(previous, formData);
    } catch (error) {
      draft.saveNow();
      throw error;
    }
    if (!result.ok) draft.saveNow();
    if (result.ok && result.data) {
      const allDone = await queue.uploadAll(targetFor(result.data.id));
      if (allDone) router.push(result.data.href);
      // Saved: keep the form on screen while the user retries or moves on.
      return { ...result, keepValues: true };
    }
    return result;
  };
  const [state, formAction, pending, value] = useFormAction(save);
  const saved = state.ok ? state.data : undefined;

  const retry = async () => {
    if (!saved) return;
    setRetrying(true);
    const allDone = await queue.uploadAll(targetFor(saved.id));
    setRetrying(false);
    if (allDone) router.push(saved.href);
  };

  return {
    draft,
    queue,
    state,
    formAction,
    pending,
    value,
    saved,
    retry,
    retrying,
    /** The record exists but some files did not upload. */
    needsRecovery: Boolean(saved) && !pending && queue.items.some((item) => item.status === "failed"),
    /** Picker and submit are locked while saving, uploading or after saving. */
    locked: pending || retrying || Boolean(saved) || queue.busy,
  };
}

export function UploadRecovery({
  message,
  href,
  retry,
  retrying,
}: {
  message: string;
  href: string;
  retry: () => void;
  retrying: boolean;
}) {
  const t = useT();
  return (
    <div role="alert" className="grid gap-3 border-l-4 border-k-warn bg-k-surface px-4 py-3">
      <p>{message}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" onClick={retry} disabled={retrying}>
          {t.app.attachments.retry}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href={href}>{t.app.attachments.continueWithout}</Link>
        </Button>
      </div>
    </div>
  );
}

/** "Restored from this tab's draft" notice with a way to start over. */
export function DraftNotice({ onDiscard }: { onDiscard: () => void }) {
  const t = useT();
  return (
    <div role="status" className="flex flex-col gap-2 border-l-4 border-k-green bg-k-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[15px]">{t.app.drafts.restored}</p>
      <Button type="button" variant="ghost" size="sm" onClick={onDiscard} className="self-start sm:self-auto">
        {t.app.drafts.discard}
      </Button>
    </div>
  );
}
