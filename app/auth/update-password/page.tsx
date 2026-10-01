import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.auth.updatePassword.title };

// Requires a session (established by /auth/confirm); the proxy redirects anonymous users.
export default function Page() {
  return <UpdatePasswordForm />;
}
