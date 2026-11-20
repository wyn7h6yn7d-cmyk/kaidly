import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getT } from "@/lib/i18n/server";

// Reads request data (session, language cookie, params): allowed to block on navigation
// instead of claiming an instant static shell (Next 16.4 instant validation).
export const instant = false;


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.forgot.title };
}

export default function Page() {
  return <ForgotPasswordForm />;
}
