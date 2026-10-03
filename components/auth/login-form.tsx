"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorCode } from "@/lib/auth/errors";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeading, AuthSubmit, AuthSwitch, FormError } from "./auth-heading";
import { AUTH_INPUT, PasswordInput } from "./password-input";
import { useFieldId } from "@/components/forms/use-field-id";
import { syncLocale } from "@/lib/actions/locale";
import { useT } from "@/lib/i18n/client";

export function LoginForm() {
  const t = useT();
  const id = useFieldId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // a second click while signing in does nothing
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) {
        setError(t.errors[authErrorCode(error)]);
        return;
      }
      // Bring this device in step with the language saved on the profile before landing.
      await syncLocale().catch(() => undefined);
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(t.errors[authErrorCode(err)]);
    } finally {
      setIsLoading(false);
    }
  };

  const next = safeRedirectPath(searchParams.get("next"));
  const isInvite = next.startsWith("/invite/");

  return (
    <>
      <AuthHeading
        title={t.auth.login.title}
        description={isInvite ? t.app.invite.loginHint : t.auth.login.description}
      />
      <form method="post" onSubmit={handleLogin} className="flex flex-col gap-5">
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
            autoComplete="current-password"
            required
            className={AUTH_INPUT}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link
            href="/auth/forgot-password"
            className="inline-flex min-h-8 items-center justify-self-end rounded-sm text-sm font-medium text-k-green underline-offset-4 hover:underline"
          >
            {t.auth.login.forgot}
          </Link>
        </div>
        <FormError message={error} />
        <AuthSubmit busy={isLoading} label={t.auth.login.submit} busyLabel={t.auth.login.submitting} />
      </form>
      <AuthSwitch>
        {t.auth.login.noAccount}{" "}
        <Link
          href={isInvite ? `/auth/sign-up?next=${encodeURIComponent(next)}` : "/auth/sign-up"}
          className="font-semibold text-k-green underline underline-offset-4"
        >
          {t.common.signUp}
        </Link>
      </AuthSwitch>
    </>
  );
}
