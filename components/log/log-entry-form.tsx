"use client";

import Link from "next/link";
import { AttachmentPicker } from "@/components/documents/attachment-picker";
import { DraftNotice, UploadRecovery, useSaveThenUpload } from "@/components/documents/use-save-then-upload";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { correctLogEntry, createLogEntry } from "@/lib/actions/log";
import type { LogEntryType } from "@/lib/validation/constants";
import { EntryTypeField } from "./entry-type-field";
import { useT } from "@/lib/i18n/client";

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
  const t = useT();
  const isCorrection = Boolean(correctionOfId);
  const upload = useSaveThenUpload(
    orgSlug,
    isCorrection ? correctLogEntry : createLogEntry,
    (id) => ({ kind: "logEntry", id }),
    isCorrection ? `kaidly:draft:correction:${correctionOfId}` : `kaidly:draft:entry:${orgSlug}:${installationId}`,
  );
  const { queue, state, formAction: action, pending, value, saved, draft, needsRecovery, retry, retrying, locked } = upload;
  const { attachForm, restored: draftRestored, discard: discardDraft } = draft;
  const id = useFieldId();
  const copy = t.app.log;
  const attachmentCopy = t.app.attachments;
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
    <form ref={attachForm} action={action} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="installationId" value={installationId} />
      {correctionOfId && <input type="hidden" name="correctionOfId" value={correctionOfId} />}

      {draftRestored && <DraftNotice onDiscard={discardDraft} />}

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
          disabled={locked}
        />
      </fieldset>

      <FormMessage code={state.errorCode} />
      {needsRecovery && saved ? (
        <UploadRecovery
          message={attachmentCopy.savedWithFailures}
          href={saved.href}
          retry={retry}
          retrying={retrying}
        />
      ) : (
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button asChild variant="ghost" size="lg">
            <Link href={cancelHref}>{t.app.cancel}</Link>
          </Button>
          <Button type="submit" size="lg" disabled={locked} className="sm:min-w-[224px]">
            {pending ? copy.saving : isCorrection ? copy.submitCorrection : copy.submit}
          </Button>
        </div>
      )}
    </form>
  );
}
