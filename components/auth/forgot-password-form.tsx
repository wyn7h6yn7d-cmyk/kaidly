"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorCode } from "@/lib/auth/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeading, FormError } from "./auth-heading";
import { useFieldId } from "@/components/forms/use-field-id";
import { useT } from "@/lib/i18n/client";

export function ForgotPasswordForm() {
  const t = useT();
  const id = useFieldId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // The recovery link lands on /auth/confirm, which establishes the session and
      // continues to /auth/update-password. That URL must be in the project's
      // allowed redirect URLs (see README).
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/auth/update-password`,
      });
      if (error) {
        setError(t.errors[authErrorCode(error)]);
        return;
      }
      setSent(true);
    } catch (err) {
      setError(t.errors[authErrorCode(err)]);
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <>
        <AuthHeading title={t.auth.forgot.sentTitle} description={t.auth.forgot.sentDescription} />
        <Link href="/auth/login" className="font-semibold text-k-green underline underline-offset-4">
          {t.common.backToLogin}
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading title={t.auth.forgot.title} description={t.auth.forgot.description} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? t.auth.forgot.submitting : t.auth.forgot.submit}
        </Button>
      </form>
      <p className="mt-8 text-sm">
        <Link href="/auth/login" className="font-semibold text-k-green underline underline-offset-4">
          {t.common.backToLogin}
        </Link>
      </p>
    </>
  );
}
