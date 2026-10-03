import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading, AuthSwitch } from "@/components/auth/auth-heading";
import { isErrorCode } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.error.title };
}

/**
 * Shows only application-controlled messages. The URL carries an error *code*; any
 * unknown or missing code falls back to a generic message, so no one can make this
 * page display text of their choosing.
 */
async function ErrorMessage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const t = await getT();
  const { code } = await searchParams;
  const message = isErrorCode(code, t) ? t.errors[code] : t.errors.unknown;
  return <p className="text-k-muted">{message}</p>;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const t = await getT();
  return (
    <>
      <AuthHeading title={t.auth.error.title} />
      <Suspense fallback={<p className="text-k-muted">{t.common.loading}</p>}>
        <ErrorMessage searchParams={searchParams} />
      </Suspense>
      <AuthSwitch>
        <Link href="/auth/login" className="font-semibold text-k-green underline underline-offset-4">
          {t.common.backToLogin}
        </Link>
      </AuthSwitch>
    </>
  );
}
