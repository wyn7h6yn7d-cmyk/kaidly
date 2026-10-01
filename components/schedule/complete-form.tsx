"use client";

import Link from "next/link";
import { EntryTypeField } from "@/components/log/entry-type-field";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { completeActivity } from "@/lib/actions/schedule";
import { t } from "@/lib/i18n";

/** Completing writes the operating-log entry, so the form is the log entry, prefilled. */
export function CompleteActivityForm({
  orgSlug,
  activityId,
  dueOn,
  title,
  occurredAt,
  performedByName,
  cancelHref,
}: {
  orgSlug: string;
  activityId: string;
  dueOn: string;
  title: string;
  occurredAt: string;
  performedByName: string | null;
  cancelHref: string;
}) {
  const [state, action, pending, value] = useFormAction(completeActivity);
  const id = useFieldId();
  const log = t.app.log;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="dueOn" value={dueOn} />

      <EntryTypeField selected={value("entryType", "inspection")} invalid={state.fields?.entryType} />
      <Field id={id("description")} label={log.fields.description}>
        <Textarea
          id={id("description")}
          name="description"
          rows={3}
          maxLength={5000}
          defaultValue={value("description", title)}
          aria-invalid={state.fields?.description}
        />
      </Field>
      <Field id={id("result")} label={log.fields.result} hint={log.fields.resultHint} optional>
        <Textarea
          id={id("result")}
          name="result"
          rows={2}
          maxLength={2000}
          defaultValue={value("result")}
          aria-describedby={`${id("result")}-hint`}
          aria-invalid={state.fields?.result}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={id("occurredAt")} label={log.fields.occurredAt}>
          <Input
            id={id("occurredAt")}
            name="occurredAt"
            type="datetime-local"
            required
            defaultValue={value("occurredAt", occurredAt)}
            aria-invalid={state.fields?.occurredAt}
          />
        </Field>
        <Field id={id("performedByName")} label={log.fields.performedBy} optional>
          <Input
            id={id("performedByName")}
            name="performedByName"
            maxLength={200}
            autoComplete="name"
            defaultValue={value("performedByName", performedByName)}
            aria-invalid={state.fields?.performedByName}
          />
        </Field>
      </div>

      <FormMessage error={state.error} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button asChild variant="ghost" size="lg">
          <Link href={cancelHref}>{t.app.cancel}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending} className="sm:min-w-56">
          {pending ? t.app.schedule.completing : t.app.schedule.completeSubmit}
        </Button>
      </div>
    </form>
  );
}
