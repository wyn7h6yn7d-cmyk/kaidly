"use client";

import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateOrganisation } from "@/lib/actions/organisations";
import { useFieldId } from "@/components/forms/use-field-id";
import { useT } from "@/lib/i18n/client";

export type OrganisationSettings = {
  id: string;
  name: string;
  registryCode: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
};

export function OrganisationSettingsForm({ organisation }: { organisation: OrganisationSettings }) {
  const t = useT();
  const id = useFieldId();
  const [state, action, pending, value] = useFormAction(updateOrganisation);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-5">
      <input type="hidden" name="organisationId" value={organisation.id} />
      <Field id={id("name")} label={t.app.createOrganisation.name}>
        <Input
          id={id("name")}
          name="name"
          required
          maxLength={200}
          defaultValue={value("name", organisation.name)}
          aria-invalid={state.fields?.name}
        />
      </Field>
      <Field id={id("registryCode")} label={t.app.createOrganisation.registryCode} optional>
        <Input
          id={id("registryCode")}
          name="registryCode"
          maxLength={30}
          inputMode="numeric"
          defaultValue={value("registryCode", organisation.registryCode)}
          aria-invalid={state.fields?.registryCode}
        />
      </Field>
      <Field id={id("contactEmail")} label={t.app.settings.contactEmail} optional>
        <Input
          id={id("contactEmail")}
          name="contactEmail"
          type="email"
          autoComplete="off"
          maxLength={254}
          defaultValue={value("contactEmail", organisation.contactEmail)}
          aria-invalid={state.fields?.contactEmail}
        />
      </Field>
      <Field id={id("contactPhone")} label={t.app.settings.contactPhone} optional>
        <Input
          id={id("contactPhone")}
          name="contactPhone"
          type="tel"
          autoComplete="off"
          maxLength={40}
          defaultValue={value("contactPhone", organisation.contactPhone)}
          aria-invalid={state.fields?.contactPhone}
        />
      </Field>
      <Field id={id("address")} label={t.app.settings.postalAddress} optional>
        <Input
          id={id("address")}
          name="address"
          maxLength={300}
          defaultValue={value("address", organisation.address)}
          aria-invalid={state.fields?.address}
        />
      </Field>
      <Field id={id("notes")} label={t.app.settings.notes} hint={t.app.settings.notesHint} optional>
        <Textarea
          id={id("notes")}
          name="notes"
          rows={4}
          maxLength={2000}
          defaultValue={value("notes", organisation.notes)}
          aria-invalid={state.fields?.notes}
        />
      </Field>
      <FormMessage code={state.errorCode} success={state.ok ? t.app.saved : undefined} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t.app.saving : t.app.save}
        </Button>
      </div>
    </form>
  );
}
