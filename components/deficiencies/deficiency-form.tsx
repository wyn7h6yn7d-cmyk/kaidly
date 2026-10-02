"use client";

import Link from "next/link";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createDeficiency, updateDeficiency } from "@/lib/actions/deficiencies";
import type { Deficiency } from "@/lib/data/deficiencies";
import { toLocalInput } from "@/lib/time";
import { SEVERITIES } from "@/lib/validation/deficiencies";
import { useT } from "@/lib/i18n/client";

type Choice = { id: string; label: string };

export function DeficiencyForm({
  orgSlug,
  installation,
  installations,
  deficiency,
  detectedAt,
  cancelHref,
}: {
  orgSlug: string;
  installation?: Choice;
  installations?: Choice[];
  deficiency?: Deficiency;
  detectedAt: string;
  cancelHref: string;
}) {
  const t = useT();
  const [state, action, pending, value] = useFormAction(deficiency ? updateDeficiency : createDeficiency);
  const id = useFieldId();
  const copy = t.app.deficiencies;
  const f = copy.fields;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      {deficiency && <input type="hidden" name="deficiencyId" value={deficiency.id} />}

      {installation ? (
        <div>
          <p className="text-sm font-semibold">{f.installation}</p>
          <p className="mt-1">{installation.label}</p>
          <input type="hidden" name="installationId" value={installation.id} />
        </div>
      ) : (
        <Field id={id("installationId")} label={f.installation}>
          <Select
            key={value("installationId")}
            id={id("installationId")}
            name="installationId"
            required
            defaultValue={value("installationId")}
            aria-invalid={state.fields?.installationId}
          >
            <option value="" disabled>
              —
            </option>
            {installations?.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field id={id("title")} label={f.title}>
        <Input
          id={id("title")}
          name="title"
          required
          maxLength={200}
          placeholder={f.titlePlaceholder}
          defaultValue={value("title", deficiency?.title)}
          aria-invalid={state.fields?.title}
        />
      </Field>
      <Field id={id("description")} label={f.description}>
        <Textarea
          id={id("description")}
          name="description"
          required
          rows={4}
          maxLength={5000}
          placeholder={f.descriptionPlaceholder}
          defaultValue={value("description", deficiency?.description)}
          aria-invalid={state.fields?.description}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={id("severity")} label={f.severity} hint={f.severityHint}>
          <Select
            key={value("severity", deficiency?.severity ?? "medium")}
            id={id("severity")}
            name="severity"
            defaultValue={value("severity", deficiency?.severity ?? "medium")}
            aria-describedby={`${id("severity")}-hint`}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {copy.severities[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={id("dueOn")} label={f.dueOn} optional>
          <Input
            id={id("dueOn")}
            name="dueOn"
            type="date"
            defaultValue={value("dueOn", deficiency?.dueOn)}
            aria-invalid={state.fields?.dueOn}
          />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={id("detectedAt")} label={f.detectedAt}>
          <Input
            id={id("detectedAt")}
            name="detectedAt"
            type="datetime-local"
            required
            defaultValue={value("detectedAt", deficiency ? toLocalInput(new Date(deficiency.detectedAt)) : detectedAt)}
            aria-invalid={state.fields?.detectedAt}
          />
        </Field>
        <Field id={id("responsiblePersonName")} label={f.responsible} optional>
          <Input
            id={id("responsiblePersonName")}
            name="responsiblePersonName"
            maxLength={200}
            defaultValue={value("responsiblePersonName", deficiency?.responsiblePersonName)}
            aria-invalid={state.fields?.responsiblePersonName}
          />
        </Field>
      </div>

      <FormMessage code={state.errorCode} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button asChild variant="ghost" size="lg">
          <Link href={cancelHref}>{t.app.cancel}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? copy.saving : deficiency ? t.app.save : copy.submitCreate}
        </Button>
      </div>
    </form>
  );
}
