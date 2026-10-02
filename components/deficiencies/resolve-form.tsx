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
import { resolveDeficiency } from "@/lib/actions/deficiencies";
import { useT } from "@/lib/i18n/client";


export function ResolveDeficiencyForm({
  orgSlug,
  deficiencyId,
  occurredAt,
  performedByName,
  cancelHref,
}: {
  orgSlug: string;
  deficiencyId: string;
  occurredAt: string;
  performedByName: string | null;
  cancelHref: string;
}) {
  const t = useT();
  const [state, action, pending, value] = useFormAction(resolveDeficiency);
  const id = useFieldId();
  const copy = t.app.deficiencies;
  const log = t.app.log;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="deficiencyId" value={deficiencyId} />

      <Field id={id("resolution")} label={copy.fields.resolution}>
        <Textarea
          id={id("resolution")}
          name="resolution"
          required
          rows={4}
          maxLength={5000}
          autoFocus
          placeholder={copy.fields.resolutionPlaceholder}
          defaultValue={value("resolution")}
          aria-invalid={state.fields?.resolution}
        />
      </Field>
      <EntryTypeField selected={value("entryType", "repair")} invalid={state.fields?.entryType} />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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

      <FormMessage code={state.errorCode} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button asChild variant="ghost" size="lg">
          <Link href={cancelHref}>{t.app.cancel}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending} className="sm:min-w-[224px]">
          {pending ? copy.resolving : copy.resolveSubmit}
        </Button>
      </div>
    </form>
  );
}
