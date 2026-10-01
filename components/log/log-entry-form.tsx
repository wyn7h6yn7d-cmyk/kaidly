"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttachmentPicker } from "@/components/documents/attachment-picker";
import { useUploadQueue } from "@/components/documents/use-upload-queue";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { correctLogEntry, createLogEntry, type SavedEntry } from "@/lib/actions/log";
import type { ActionState } from "@/lib/actions/state";
import { t } from "@/lib/i18n";
import type { LogEntryType } from "@/lib/validation/log";
import { EntryTypeField } from "./entry-type-field";

export type LogEntryDefaults = {
  entryType?: LogEntryType;
  occurredAt: string; // datetime-local value, Tallinn
  description?: string;
  result?: string | null;
  performedByName?: string | null;
};

/**
 * New entry or correction. Organisation and installation are already known from the URL,
 * so the form only asks for what happened. Rarely changed fields start collapsed.
 *
 * Photos: the entry is saved first, then the chosen files upload to it (the author may
 * attach files for 24 hours after saving). If an upload fails the entry is already safe;
 * the user can retry or continue without the file — nothing typed is lost.
 */
export function LogEntryForm({
  orgSlug,
  installationId,
  defaults,
  correctionOfId,
  cancelHref,
}: {
  orgSlug: string;
  installationId: string;
  defaults: LogEntryDefaults;
  correctionOfId?: string;
  cancelHref: string;
}) {
  const isCorrection = Boolean(correctionOfId);
  const router = useRouter();
  const queue = useUploadQueue({ orgSlug, resizeImages: true });
  const [retrying, setRetrying] = useState(false);

  const save = async (previous: ActionState<SavedEntry>, formData: FormData) => {
    if (queue.items.length) formData.set("withAttachments", "1");
    const result = await (isCorrection ? correctLogEntry : createLogEntry)(previous, formData);
    if (result.ok && result.data) {
      const allDone = await queue.uploadAll({ kind: "logEntry", id: result.data.entryId });
      if (allDone) router.push(result.data.href);
      // The entry is saved; keep it on screen while the user retries or moves on.
      return { ...result, keepValues: true };
    }
    return result;
  };
  const [state, action, pending, value] = useFormAction(save);
  const saved = state.ok ? state.data : undefined;
  const id = useFieldId();
  const copy = t.app.log;
  const attachmentCopy = t.app.attachments;

  const retry = async () => {
    if (!saved) return;
    setRetrying(true);
    const allDone = await queue.uploadAll({ kind: "logEntry", id: saved.entryId });
    setRetrying(false);
    if (allDone) router.push(saved.href);
  };
  const selectedType = value("entryType", defaults.entryType);
  const detailsHaveError = Boolean(
    state.fields?.occurredAt || state.fields?.result || state.fields?.performedByName,
  );

  const details = (
    <>
      <Field id={id("result")} label={copy.fields.result} hint={copy.fields.resultHint} optional>
        <Textarea
          id={id("result")}
          name="result"
          rows={2}
          maxLength={2000}
          defaultValue={value("result", defaults.result)}
          aria-describedby={`${id("result")}-hint`}
          aria-invalid={state.fields?.result}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={id("occurredAt")} label={copy.fields.occurredAt}>
          <Input
            id={id("occurredAt")}
            name="occurredAt"
            type="datetime-local"
            required
            defaultValue={value("occurredAt", defaults.occurredAt)}
            aria-invalid={state.fields?.occurredAt}
          />
        </Field>
        <Field id={id("performedByName")} label={copy.fields.performedBy} hint={copy.fields.performedByHint} optional>
          <Input
            id={id("performedByName")}
            name="performedByName"
            maxLength={200}
            autoComplete="name"
            defaultValue={value("performedByName", defaults.performedByName)}
            aria-describedby={`${id("performedByName")}-hint`}
            aria-invalid={state.fields?.performedByName}
          />
        </Field>
      </div>
    </>
  );

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="installationId" value={installationId} />
      {correctionOfId && <input type="hidden" name="correctionOfId" value={correctionOfId} />}

      {isCorrection && (
        <p className="border-l-4 border-k-green bg-k-surface px-4 py-3">{copy.correctionExplanation}</p>
      )}

      <EntryTypeField selected={selectedType} invalid={state.fields?.entryType} />

      <Field id={id("description")} label={copy.fields.description}>
        <Textarea
          id={id("description")}
          name="description"
          required
          rows={4}
          maxLength={5000}
          autoFocus={!isCorrection}
          placeholder={copy.fields.descriptionPlaceholder}
          defaultValue={value("description", defaults.description)}
          aria-invalid={state.fields?.description}
        />
      </Field>

      {isCorrection ? (
        <>
          {details}
          <Field id={id("correctionReason")} label={copy.correctionReason} hint={copy.correctionReasonHint}>
            <Textarea
              id={id("correctionReason")}
              name="correctionReason"
              required
              rows={2}
              maxLength={1000}
              defaultValue={value("correctionReason")}
              aria-describedby={`${id("correctionReason")}-hint`}
              aria-invalid={state.fields?.correctionReason}
            />
          </Field>
        </>
      ) : (
        <details open={detailsHaveError || undefined} className="group border-t border-k-line pt-4">
          <summary className="flex h-11 cursor-pointer items-center text-[15px] font-semibold text-k-green">
            {copy.moreDetails}
          </summary>
          <div className="mt-4 flex flex-col gap-5">{details}</div>
        </details>
      )}

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[15px] font-semibold">{attachmentCopy.photos}</legend>
        <AttachmentPicker
          queue={queue}
          label={attachmentCopy.takePhoto}
          hint={isCorrection ? `${attachmentCopy.correctionHint} ${attachmentCopy.hint}` : attachmentCopy.hint}
          disabled={pending || retrying || Boolean(saved)}
        />
      </fieldset>

      <FormMessage error={state.error} />
      {saved && !pending && queue.items.some((item) => item.status === "failed") ? (
        <div role="alert" className="grid gap-3 border-l-4 border-k-warn bg-k-surface px-4 py-3">
          <p>{attachmentCopy.savedWithFailures}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" size="lg" onClick={retry} disabled={retrying}>
              {attachmentCopy.retry}
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href={saved.href}>{attachmentCopy.continueWithout}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button asChild variant="ghost" size="lg">
            <Link href={cancelHref}>{t.app.cancel}</Link>
          </Button>
          <Button type="submit" size="lg" disabled={pending || queue.busy || Boolean(saved)} className="sm:min-w-56">
            {pending ? copy.saving : isCorrection ? copy.submitCorrection : copy.submit}
          </Button>
        </div>
      )}
    </form>
  );
}
