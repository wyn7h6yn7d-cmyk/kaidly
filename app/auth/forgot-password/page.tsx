import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.auth.forgot.title };

export default function Page() {
  return <ForgotPasswordForm />;
}
