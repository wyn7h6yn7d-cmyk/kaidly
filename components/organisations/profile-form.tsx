"use client";

import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/lib/actions/organisations";
import { useFieldId } from "@/components/forms/use-field-id";
import { useT } from "@/lib/i18n/client";

export function ProfileForm({
  profile,
}: {
  profile: { fullName: string | null; phone: string | null };
}) {
  const t = useT();
  const id = useFieldId();
  const [state, action, pending, value] = useFormAction(updateProfile);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-5">
      <Field id={id("fullName")} label={t.common.fullName}>
        <Input
          id={id("fullName")}
          name="fullName"
          required
          maxLength={200}
          autoComplete="name"
          defaultValue={value("fullName", profile.fullName)}
          aria-invalid={state.fields?.fullName}
        />
      </Field>
      <Field id={id("phone")} label={t.app.account.phone} optional>
        <Input
          id={id("phone")}
          name="phone"
          type="tel"
          maxLength={40}
          autoComplete="tel"
          defaultValue={value("phone", profile.phone)}
          aria-invalid={state.fields?.phone}
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
