import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getT } from "@/lib/i18n/server";

// Reads request data (session, language cookie, params): allowed to block on navigation
// instead of claiming an instant static shell (Next 16.4 instant validation).
export const instant = false;


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
