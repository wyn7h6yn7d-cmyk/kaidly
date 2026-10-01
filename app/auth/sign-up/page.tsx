import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.auth.signUp.title };

export default function Page() {
  return <SignUpForm />;
}
