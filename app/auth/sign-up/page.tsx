import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getT } from "@/lib/i18n/server";

// Reads request data (session, language cookie, params): allowed to block on navigation
// instead of claiming an instant static shell (Next 16.4 instant validation).
export const instant = false;


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.signUp.title };
}

export default function Page() {
  // SignUpForm reads ?next=, which is request data: keep it behind Suspense.
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
