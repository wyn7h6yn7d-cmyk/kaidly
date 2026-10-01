"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorCode } from "@/lib/auth/errors";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeading, FormError } from "./auth-heading";
import { useFieldId } from "@/components/forms/use-field-id";

const MIN_PASSWORD_LENGTH = 10;

export function SignUpForm() {
  const id = useFieldId();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  // An invitation link survives sign-up and email confirmation.
  const next = safeRedirectPath(useSearchParams().get("next"));

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t.errors.weak_password);
      return;
    }
    if (password !== repeatPassword) {
      setError(t.auth.signUp.passwordsDoNotMatch);
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
      <form onSubmit={handleSignUp} className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor={id("full-name")}>{t.common.fullName}</Label>
          <Input
            id={id("full-name")}
            name="fullName"
            autoComplete="name"
            required
            maxLength={200}
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("password")}>{t.common.password}</Label>
          <Input
            id={id("password")}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            aria-describedby={`${id("password")}-hint`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p id={id("password-hint")} className="text-sm text-k-muted">
            {t.auth.signUp.passwordHint}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("repeat-password")}>{t.auth.signUp.repeatPassword}</Label>
          <Input
            id={id("repeat-password")}
            name="repeatPassword"
            type="password"
            autoComplete="new-password"
            required
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
          />
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? t.auth.signUp.submitting : t.auth.signUp.submit}
        </Button>
      </form>
      <p className="mt-8 text-sm text-k-muted">
        {t.auth.signUp.haveAccount}{" "}
        <Link
          href={next.startsWith("/invite/") ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login"}
          className="font-semibold text-k-green underline underline-offset-4"
        >
          {t.common.signIn}
        </Link>
      </p>
    </>
  );
}
