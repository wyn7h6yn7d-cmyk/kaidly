"use client";

import Link from "next/link";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createInstallation, updateInstallation } from "@/lib/actions/sites";
import type { Installation } from "@/lib/data/sites";
import { INSTALLATION_STATUSES, INSTALLATION_TYPES } from "@/lib/validation/sites";
import { useFieldId } from "@/components/forms/use-field-id";
import { useT } from "@/lib/i18n/client";

export function InstallationForm({
  orgSlug,
  sites,
  defaultSiteId,
  installation,
  cancelHref,
}: {
  orgSlug: string;
  sites: { id: string; name: string }[];
  defaultSiteId?: string;
  installation?: Installation;
  cancelHref: string;
}) {
  const t = useT();
  const id = useFieldId();
  const [state, action, pending, value] = useFormAction(
    installation ? updateInstallation : createInstallation,
  );
  const f = t.app.installations.fields;
  // Keep an installation's current (possibly archived) site selectable when editing.
  const siteOptions =
    installation && !sites.some((site) => site.id === installation.site.id)
      ? [{ id: installation.site.id, name: installation.site.name }, ...sites]
      : sites;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      {installation && <input type="hidden" name="installationId" value={installation.id} />}

      <Field id={id("siteId")} label={f.site}>
        <Select
          key={value("siteId", installation?.site.id ?? defaultSiteId ?? siteOptions[0]?.id)}
          id={id("siteId")}
          name="siteId"
          required
          defaultValue={value("siteId", installation?.site.id ?? defaultSiteId ?? siteOptions[0]?.id)}
          aria-invalid={state.fields?.siteId}
        >
          {siteOptions.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
        <Field id={id("name")} label={f.name}>
          <Input
            id={id("name")}
            name="name"
            required
            maxLength={200}
            placeholder={f.namePlaceholder}
            defaultValue={value("name", installation?.name)}
            aria-invalid={state.fields?.name}
          />
        </Field>
        <Field id={id("identifier")} label={f.identifier} hint={f.identifierHint} optional>
          <Input
            id={id("identifier")}
            name="identifier"
            maxLength={50}
            autoCapitalize="characters"
            defaultValue={value("identifier", installation?.identifier)}
            aria-describedby={`${id("identifier")}-hint`}
            aria-invalid={state.fields?.identifier}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={id("installationType")} label={f.type}>
          <Select
            key={value("installationType", installation?.installationType ?? "building")}
            id={id("installationType")}
            name="installationType"
            required
            defaultValue={value("installationType", installation?.installationType ?? "building")}
          >
            {INSTALLATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {t.app.installations.types[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={id("status")} label={f.status}>
          <Select
            key={value("status", installation?.status ?? "in_service")}
            id={id("status")}
            name="status"
            required
            defaultValue={value("status", installation?.status ?? "in_service")}
          >
            {INSTALLATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t.app.installations.statuses[status]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
        <Field id={id("location")} label={f.location} optional>
          <Input
            id={id("location")}
            name="location"
            maxLength={200}
            placeholder={f.locationPlaceholder}
            defaultValue={value("location", installation?.location)}
            aria-invalid={state.fields?.location}
          />
        </Field>
        <Field id={id("commissionedOn")} label={f.commissionedOn} optional>
          <Input
            id={id("commissionedOn")}
            name="commissionedOn"
            type="date"
            min="1900-01-01"
            defaultValue={value("commissionedOn", installation?.commissionedOn)}
            aria-invalid={state.fields?.commissionedOn}
          />
        </Field>
      </div>

      <Field id={id("responsiblePerson")} label={f.responsiblePerson} hint={f.responsibleHint} optional>
        <Input
          id={id("responsiblePerson")}
          name="responsiblePerson"
          maxLength={200}
          defaultValue={value("responsiblePerson", installation?.responsiblePerson)}
          aria-describedby={`${id("responsiblePerson")}-hint`}
          aria-invalid={state.fields?.responsiblePerson}
        />
      </Field>
      <Field id={id("description")} label={f.description} optional>
        <Textarea
          id={id("description")}
          name="description"
          maxLength={5000}
          rows={3}
          defaultValue={value("description", installation?.description)}
          aria-invalid={state.fields?.description}
        />
      </Field>
      <Field id={id("notes")} label={f.notes} hint={f.notesHint} optional>
        <Textarea
          id={id("notes")}
          name="notes"
          maxLength={5000}
          rows={3}
          defaultValue={value("notes", installation?.notes)}
          aria-describedby={`${id("notes")}-hint`}
          aria-invalid={state.fields?.notes}
        />
      </Field>

      <FormMessage code={state.errorCode} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button asChild variant="ghost" size="lg">
          <Link href={cancelHref}>{t.app.cancel}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending
            ? t.app.installations.submitting
            : installation
              ? t.app.save
              : t.app.installations.submitCreate}
        </Button>
      </div>
    </form>
  );
}
