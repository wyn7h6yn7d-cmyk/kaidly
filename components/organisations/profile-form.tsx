"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/lib/actions/organisations";
import { initialState } from "@/lib/actions/state";
import { t } from "@/lib/i18n";

export function ProfileForm({
  profile,
}: {
  profile: { fullName: string | null; email: string | null; phone: string | null };
}) {
  const [state, action, pending] = useActionState(updateProfile, initialState);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-5">
      <Field id="fullName" label={t.common.fullName}>
        <Input
          id="fullName"
          name="fullName"
          required
          maxLength={200}
          autoComplete="name"
          defaultValue={profile.fullName ?? ""}
          aria-invalid={state.fields?.fullName}
        />
      </Field>
      <Field id="phone" label={t.app.account.phone} optional>
        <Input
          id="phone"
          name="phone"
          type="tel"
          maxLength={40}
          autoComplete="tel"
          defaultValue={profile.phone ?? ""}
          aria-invalid={state.fields?.phone}
        />
      </Field>
      <Field id="email" label={t.common.email} hint={t.app.account.emailReadOnly}>
        <Input id="email" value={profile.email ?? ""} readOnly disabled aria-describedby="email-hint" />
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
