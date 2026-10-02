"use client";

import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createActivity, updateActivity } from "@/lib/actions/schedule";
import type { Activity } from "@/lib/data/schedule";
import { cn } from "@/lib/utils";
import { FREQUENCIES, INTERVAL_UNITS, PRIORITIES } from "@/lib/validation/schedule";
import { useT } from "@/lib/i18n/client";

type InstallationChoice = { id: string; label: string };

export function ActivityForm({
  orgSlug,
  installation,
  installations,
  activity,
  defaultDueOn,
  cancelHref,
}: {
  orgSlug: string;
  /** Known context (from an installation page or when editing): shown, not selectable. */
  installation?: InstallationChoice;
  /** Otherwise the installations to choose from. */
  installations?: InstallationChoice[];
  activity?: Activity;
  defaultDueOn: string;
  cancelHref: string;
}) {
  const t = useT();
  const [state, action, pending, value] = useFormAction(activity ? updateActivity : createActivity);
  const id = useFieldId();
  const f = t.app.schedule.fields;
  const copy = t.app.schedule;
  const submittedFrequency = value("frequencyType", activity?.frequencyType ?? "recurring");
  const [frequency, setFrequency] = useState(submittedFrequency);

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      {activity && <input type="hidden" name="activityId" value={activity.id} />}

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
          defaultValue={value("title", activity?.title)}
          aria-invalid={state.fields?.title}
        />
      </Field>

      <fieldset key={submittedFrequency}>
        <legend className="mb-2 text-sm font-semibold">{f.frequency}</legend>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="frequencyType"
                value={option}
                defaultChecked={submittedFrequency === option}
                onChange={() => setFrequency(option)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex h-11 cursor-pointer items-center rounded-sm border border-k-grey/60 bg-k-surface px-4 text-[15px] font-semibold",
                  "peer-checked:border-k-green peer-checked:bg-k-green peer-checked:text-white",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                )}
              >
                {copy.frequency[option]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {frequency === "recurring" && (
        <fieldset aria-invalid={state.fields?.intervalValue || state.fields?.intervalUnit}>
          <legend className="mb-2 text-sm font-semibold">{f.interval}</legend>
          <div className="flex items-center gap-3">
            <span aria-hidden="true">{f.intervalEvery}</span>
            <Input
              id={id("intervalValue")}
              name="intervalValue"
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              required
              aria-label={`${f.interval}: ${f.intervalEvery}`}
              defaultValue={value("intervalValue", activity?.intervalValue?.toString() ?? "12")}
              className="w-24"
              aria-invalid={state.fields?.intervalValue}
            />
            <Select
              key={value("intervalUnit", activity?.intervalUnit ?? "month")}
              id={id("intervalUnit")}
              name="intervalUnit"
              aria-label={f.interval}
              defaultValue={value("intervalUnit", activity?.intervalUnit ?? "month")}
              className="w-40"
            >
              {INTERVAL_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {copy.units[unit]}
                </option>
              ))}
            </Select>
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id={id("nextDueOn")}
          label={activity ? f.nextDueOn : frequency === "recurring" ? f.firstDueOn : f.dueOn}
          hint={frequency === "recurring" ? f.nextDueHint : undefined}
        >
          <Input
            id={id("nextDueOn")}
            name="nextDueOn"
            type="date"
            required
            defaultValue={value("nextDueOn", activity?.nextDueOn ?? defaultDueOn)}
            aria-describedby={frequency === "recurring" ? `${id("nextDueOn")}-hint` : undefined}
            aria-invalid={state.fields?.nextDueOn}
          />
        </Field>
        <Field id={id("priority")} label={f.priority}>
          <Select
            key={value("priority", activity?.priority ?? "normal")}
            id={id("priority")}
            name="priority"
            defaultValue={value("priority", activity?.priority ?? "normal")}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {copy.priorities[p]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field id={id("responsiblePersonName")} label={f.responsible} optional>
        <Input
          id={id("responsiblePersonName")}
          name="responsiblePersonName"
          maxLength={200}
          defaultValue={value("responsiblePersonName", activity?.responsiblePersonName)}
          aria-invalid={state.fields?.responsiblePersonName}
        />
      </Field>
      <Field id={id("description")} label={f.description} optional>
        <Textarea
          id={id("description")}
          name="description"
          rows={3}
          maxLength={5000}
          defaultValue={value("description", activity?.description)}
          aria-invalid={state.fields?.description}
        />
      </Field>

      <FormMessage code={state.errorCode} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button asChild variant="ghost" size="lg">
          <Link href={cancelHref}>{t.app.cancel}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? copy.saving : activity ? t.app.save : copy.submitCreate}
        </Button>
      </div>
    </form>
  );
}
