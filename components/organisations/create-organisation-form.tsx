"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrganisation } from "@/lib/actions/organisations";
import { initialState } from "@/lib/actions/state";
import { t } from "@/lib/i18n";

export function CreateOrganisationForm() {
  const [state, action, pending] = useActionState(createOrganisation, initialState);
  const copy = t.app.createOrganisation;

  return (
    <form action={action} className="flex max-w-lg flex-col gap-5">
      <Field id="name" label={copy.name}>
        <Input
          id="name"
          name="name"
          required
          maxLength={200}
          autoComplete="organization"
          placeholder={copy.namePlaceholder}
          aria-invalid={state.fields?.name}
        />
      </Field>
      <Field id="registryCode" label={copy.registryCode} optional>
        <Input
          id="registryCode"
          name="registryCode"
          maxLength={30}
          inputMode="numeric"
          aria-invalid={state.fields?.registryCode}
        />
      </Field>
      <FormMessage error={state.error} />
      <div>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? copy.submitting : copy.submit}
        </Button>
      </div>
    </form>
  );
}
