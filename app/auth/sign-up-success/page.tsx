import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.signUpSuccess.title };
}

export default async function Page() {
  const t = await getT();
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
