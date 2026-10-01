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

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) {
        setError(t.errors[authErrorCode(error)]);
        return;
      }
      router.replace(safeRedirectPath(searchParams.get("next")));
      router.refresh();
    } catch (err) {
      setError(t.errors[authErrorCode(err)]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthHeading title={t.auth.login.title} description={t.auth.login.description} />
      <form onSubmit={handleLogin} className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor="email">{t.common.email}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <Label htmlFor="password">{t.common.password}</Label>
            <Link
              href="/auth/forgot-password"
              className="text-sm text-k-green underline-offset-4 hover:underline"
            >
              {t.auth.login.forgot}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? t.auth.login.submitting : t.auth.login.submit}
        </Button>
      </form>
      <p className="mt-8 text-sm text-k-muted">
        {t.auth.login.noAccount}{" "}
        <Link href="/auth/sign-up" className="font-semibold text-k-green underline underline-offset-4">
          {t.common.signUp}
        </Link>
      </p>
    </>
  );
}
