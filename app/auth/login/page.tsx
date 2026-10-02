import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.login.title };
}

export default function Page() {
  // LoginForm reads ?next=, which is request data: keep it behind Suspense.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
