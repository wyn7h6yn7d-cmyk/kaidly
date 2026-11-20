"use client";

import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordAudit, setNextAudit } from "@/lib/actions/audits";
import { useT } from "@/lib/i18n/client";

/** Owner/admin: record a completed periodic audit and (optionally) the next deadline. */
export function AuditForm({ orgSlug, installationId, today }: { orgSlug: string; installationId: string; today: string }) {
  const t = useT();
  const id = useFieldId();
  const a = t.app.audits;
  const [state, action, pending, value] = useFormAction(recordAudit);
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2" key={state.ok ? "saved" : "form"} data-testid="audit-form">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="installationId" value={installationId} />
      <Field id={id("audited-on")} label={a.fields.auditedOn}>
        <Input id={id("audited-on")} name="auditedOn" type="date" max={today} required defaultValue={value("auditedOn")} aria-invalid={state.fields?.auditedOn} />
      </Field>
      <Field id={id("auditor")} label={a.fields.auditor}>
        <Input id={id("auditor")} name="auditor" required maxLength={200} defaultValue={value("auditor")} aria-invalid={state.fields?.auditor} />
      </Field>
      <div className="sm:col-span-2">
        <Field id={id("result")} label={a.fields.result}>
          <Input id={id("result")} name="result" required maxLength={2000} placeholder={a.resultHint} defaultValue={value("result")} aria-invalid={state.fields?.result} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id={id("document")} label={a.fields.documentUrl} optional>
          <Input id={id("document")} name="documentUrl" type="url" inputMode="url" placeholder="https://" defaultValue={value("documentUrl")} aria-invalid={state.fields?.documentUrl} aria-describedby={`${id("document")}-hint`} />
        </Field>
        <p id={id("document-hint")} className="mt-1 text-sm text-k-muted">{a.documentHint}</p>
      </div>
      <div className="sm:col-span-2">
        <Field id={id("next")} label={a.fields.nextDueOn} optional>
          <Input id={id("next")} name="nextDueOn" type="date" min={today} defaultValue={value("nextDueOn")} aria-invalid={state.fields?.nextDueOn} aria-describedby={`${id("next")}-hint`} />
        </Field>
        <p id={id("next-hint")} className="mt-1 text-sm text-k-muted">{a.nextHint}</p>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? a.saving : a.add}</Button>
        <FormMessage code={state.errorCode} />
      </div>
    </form>
  );
}

/** Owner/admin: change only the next deadline. */
export function NextAuditForm({ orgSlug, installationId, today, current }: { orgSlug: string; installationId: string; today: string; current: string | null }) {
  const t = useT();
  const id = useFieldId();
  const a = t.app.audits;
  const [state, action, pending, value] = useFormAction(setNextAudit);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="installationId" value={installationId} />
      <Field id={id("next-only")} label={a.fields.nextDueOn}>
        <Input id={id("next-only")} name="nextDueOn" type="date" min={today} required defaultValue={value("nextDueOn", current)} />
      </Field>
      <Button type="submit" variant="outline" disabled={pending}>{pending ? a.saving : a.setNext}</Button>
      <FormMessage code={state.errorCode} />
    </form>
  );
}
