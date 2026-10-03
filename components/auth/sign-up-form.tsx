"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authErrorCode } from "@/lib/auth/errors";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeading, AuthSubmit, AuthSwitch, FormError } from "./auth-heading";
import { AUTH_INPUT, PasswordInput } from "./password-input";
import { useFieldId } from "@/components/forms/use-field-id";
import { useT } from "@/lib/i18n/client";

const MIN_PASSWORD_LENGTH = 10;

export function SignUpForm() {
  const t = useT();
  const id = useFieldId();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [repeatTouched, setRepeatTouched] = useState(false);
  const router = useRouter();
  const lengthMet = password.length >= MIN_PASSWORD_LENGTH;
  // Shown once the repeat field has been left, or as soon as it is as long as the password.
  const mismatch =
    repeatPassword !== "" && (repeatTouched || repeatPassword.length >= password.length) && repeatPassword !== password;
  // An invitation link survives sign-up and email confirmation.
  const next = safeRedirectPath(useSearchParams().get("next"));

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t.errors.weak_password);
      return;
    }
    if (password !== repeatPassword) {
      setRepeatTouched(true);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await createClient().auth.signUp({
        email,
        password,
        options: {
          // Read by the profiles trigger (supabase/migrations/*_foundation.sql).
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        setError(t.errors[authErrorCode(error)]);
        return;
      }
      router.push("/auth/sign-up-success");
    } catch (err) {
      setError(t.errors[authErrorCode(err)]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthHeading title={t.auth.signUp.title} description={t.auth.signUp.description} />
      <form method="post" onSubmit={handleSignUp} className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor={id("full-name")}>{t.common.fullName}</Label>
          <Input
            id={id("full-name")}
            name="fullName"
            autoComplete="name"
            required
            maxLength={200}
            className={AUTH_INPUT}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("email")}>{t.common.email}</Label>
          <Input
            id={id("email")}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            className={AUTH_INPUT}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("password")}>{t.common.password}</Label>
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
          <p
            id={id("password-hint")}
            data-met={lengthMet}
            className="flex items-center gap-1.5 text-sm text-k-muted data-[met=true]:text-k-green"
          >
            {lengthMet && <Check className="size-4" aria-hidden="true" />}
            {t.auth.signUp.passwordHint}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("repeat-password")}>{t.auth.signUp.repeatPassword}</Label>
          <PasswordInput
            id={id("repeat-password")}
            name="repeatPassword"
            autoComplete="new-password"
            required
            aria-invalid={mismatch || undefined}
            aria-describedby={mismatch ? id("repeat-error") : undefined}
            className={AUTH_INPUT}
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            onBlur={() => setRepeatTouched(true)}
          />
          {mismatch && (
            <p id={id("repeat-error")} className="text-sm font-medium text-k-danger">
              {t.auth.signUp.passwordsDoNotMatch}
            </p>
          )}
        </div>
        <FormError message={error} />
        <AuthSubmit busy={isLoading} label={t.auth.signUp.submit} busyLabel={t.auth.signUp.submitting} />
      </form>
      <AuthSwitch>
        {t.auth.signUp.haveAccount}{" "}
        <Link
          href={next.startsWith("/invite/") ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login"}
          className="font-semibold text-k-green underline underline-offset-4"
        >
          {t.common.signIn}
        </Link>
      </AuthSwitch>
    </>
  );
}
