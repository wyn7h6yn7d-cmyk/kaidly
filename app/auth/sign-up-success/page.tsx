import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.auth.signUpSuccess.title };

export default function Page() {
  return (
    <>
      <AuthHeading
        title={t.auth.signUpSuccess.title}
        description={t.auth.signUpSuccess.description}
      />
      <Link href="/auth/login" className="font-semibold text-k-green underline underline-offset-4">
        {t.common.backToLogin}
      </Link>
    </>
  );
}
