import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { isErrorCode, t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.auth.error.title };

/**
 * Shows only application-controlled messages. The URL carries an error *code*; any
 * unknown or missing code falls back to a generic message, so no one can make this
 * page display text of their choosing.
 */
async function ErrorMessage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const { code } = await searchParams;
  const message = isErrorCode(code) ? t.errors[code] : t.errors.unknown;
  return <p className="mb-8 text-k-muted">{message}</p>;
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  return (
    <>
      <AuthHeading title={t.auth.error.title} />
      <Suspense fallback={<p className="mb-8 text-k-muted">{t.common.loading}</p>}>
        <ErrorMessage searchParams={searchParams} />
      </Suspense>
      <Link href="/auth/login" className="font-semibold text-k-green underline underline-offset-4">
        {t.common.backToLogin}
      </Link>
    </>
  );
}
