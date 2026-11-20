import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { getT } from "@/lib/i18n/server";

// Reads request data (session, language cookie, params): allowed to block on navigation
// instead of claiming an instant static shell (Next 16.4 instant validation).
export const instant = false;


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.updatePassword.title };
}

// Requires a session (established by /auth/confirm); the proxy redirects anonymous users.
export default function Page() {
  return <UpdatePasswordForm />;
}
