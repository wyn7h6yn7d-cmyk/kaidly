import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.updatePassword.title };
}

// Requires a session (established by /auth/confirm); the proxy redirects anonymous users.
export default function Page() {
  return <UpdatePasswordForm />;
}
