"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateOrganisation } from "@/lib/actions/organisations";
import { initialState } from "@/lib/actions/state";
import { t } from "@/lib/i18n";

export function OrganisationSettingsForm({
  organisation,
}: {
  organisation: { id: string; name: string; registryCode: string | null };
}) {
  const [state, action, pending] = useActionState(updateOrganisation, initialState);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-5">
      <input type="hidden" name="organisationId" value={organisation.id} />
      <Field id="name" label={t.app.createOrganisation.name}>
        <Input
          id="name"
          name="name"
          required
          maxLength={200}
          defaultValue={organisation.name}
          aria-invalid={state.fields?.name}
        />
      </Field>
      <Field id="registryCode" label={t.app.createOrganisation.registryCode} optional>
        <Input
          id="registryCode"
          name="registryCode"
          maxLength={30}
          inputMode="numeric"
          defaultValue={organisation.registryCode ?? ""}
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
