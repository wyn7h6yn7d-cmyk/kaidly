import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.auth.login.title };

export default function Page() {
  // LoginForm reads ?next=, which is request data: keep it behind Suspense.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
