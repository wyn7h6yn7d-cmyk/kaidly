"use client";

import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateOrganisation } from "@/lib/actions/organisations";
import { t } from "@/lib/i18n";
import { useFieldId } from "@/components/forms/use-field-id";

export function OrganisationSettingsForm({
  organisation,
}: {
  organisation: { id: string; name: string; registryCode: string | null };
}) {
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
      <FormMessage error={state.error} success={state.ok ? t.app.saved : undefined} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t.app.saving : t.app.save}
        </Button>
      </div>
    </form>
  );
}
