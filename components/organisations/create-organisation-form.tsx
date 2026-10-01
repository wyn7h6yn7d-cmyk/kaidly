"use client";

import { FormMessage } from "@/components/forms/form-message";
import { useFormAction } from "@/components/forms/use-form-action";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrganisation } from "@/lib/actions/organisations";
import { t } from "@/lib/i18n";
import { useFieldId } from "@/components/forms/use-field-id";

export function CreateOrganisationForm() {
  const id = useFieldId();
  const [state, action, pending, value] = useFormAction(createOrganisation);
  const copy = t.app.createOrganisation;

  return (
    <form action={action} className="flex max-w-lg flex-col gap-5">
      <Field id={id("name")} label={copy.name}>
        <Input
          id={id("name")}
          name="name"
          required
          maxLength={200}
          autoComplete="organization"
          placeholder={copy.namePlaceholder}
          defaultValue={value("name")}
          aria-invalid={state.fields?.name}
        />
      </Field>
      <Field id={id("registryCode")} label={copy.registryCode} optional>
        <Input
          id={id("registryCode")}
          name="registryCode"
          maxLength={30}
          inputMode="numeric"
          defaultValue={value("registryCode")}
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
