"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorCode } from "@/lib/auth/errors";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/redirect";
import { Label } from "@/components/ui/label";
import { AuthHeading, AuthSubmit, FormError } from "./auth-heading";
import { AUTH_INPUT, PasswordInput } from "./password-input";
import { useFieldId } from "@/components/forms/use-field-id";
import { useT } from "@/lib/i18n/client";

const MIN_PASSWORD_LENGTH = 10;

export function UpdatePasswordForm() {
  const t = useT();
  const id = useFieldId();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t.errors.weak_password);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        setError(t.errors[authErrorCode(error)]);
        return;
      }
      router.replace(DEFAULT_AFTER_LOGIN);
      router.refresh();
    } catch (err) {
      setError(t.errors[authErrorCode(err)]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthHeading
        title={t.auth.updatePassword.title}
        description={t.auth.updatePassword.description}
      />
      <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor={id("password")}>{t.auth.updatePassword.newPassword}</Label>
          <PasswordInput
            id={id("password")}
            name="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            aria-describedby={id("password-hint")}
            className={AUTH_INPUT}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p id={id("password-hint")} className="text-sm text-k-muted">
            {t.auth.signUp.passwordHint}
          </p>
        </div>
        <FormError message={error} />
        <AuthSubmit busy={isLoading} label={t.auth.updatePassword.submit} busyLabel={t.auth.updatePassword.submitting} />
      </form>
    </>
  );
}
