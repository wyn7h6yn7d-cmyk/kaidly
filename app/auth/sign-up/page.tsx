import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.auth.signUp.title };

export default function Page() {
  // SignUpForm reads ?next=, which is request data: keep it behind Suspense.
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
