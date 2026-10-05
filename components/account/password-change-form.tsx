"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { useFieldId } from "@/components/forms/use-field-id";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";
import { changePassword } from "@/lib/actions/account";
import { initialState } from "@/lib/actions/state";
import { useT } from "@/lib/i18n/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation/constants";

/**
 * Password change with the current password. Plain useActionState (not useFormAction):
 * typed passwords are never kept or re-rendered after a submit — the fields clear.
 */
export function PasswordChangeForm() {
  const t = useT();
  const id = useFieldId();
  const [state, action, pending] = useActionState(changePassword, initialState);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-5">
      <Field id={id("currentPassword")} label={t.app.account.currentPassword}>
        <PasswordInput
          id={id("currentPassword")}
          name="currentPassword"
          autoComplete="current-password"
          required
          aria-invalid={state.fields?.currentPassword}
        />
      </Field>
      <Field id={id("newPassword")} label={t.app.account.newPassword} hint={t.auth.signUp.passwordHint}>
        <PasswordInput
          id={id("newPassword")}
          name="newPassword"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          aria-invalid={state.fields?.newPassword}
          aria-describedby={`${id("newPassword")}-hint`}
        />
      </Field>
      <Field id={id("confirmPassword")} label={t.app.account.confirmPassword}>
        <PasswordInput
          id={id("confirmPassword")}
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          aria-invalid={state.fields?.confirmPassword}
        />
      </Field>
      <FormMessage code={state.errorCode} success={state.ok ? t.app.account.passwordChanged : undefined} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? t.app.saving : t.app.account.passwordSubmit}
        </Button>
        <Link href="/auth/forgot-password" className="text-sm font-semibold text-k-green underline underline-offset-4">
          {t.app.account.forgotPassword}
        </Link>
      </div>
    </form>
  );
}
