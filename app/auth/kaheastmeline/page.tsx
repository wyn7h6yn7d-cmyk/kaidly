import type { Metadata } from "next";
import { Suspense } from "react";
import { TwoStepFlow } from "@/components/auth/two-step-flow";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.twoStep.title, referrer: "no-referrer" };
}

// Requires a session (the proxy sends anonymous visitors to login). Reached from the proxy
// (a verified authenticator but an aal1 session), the admin console (admins must use it)
// and the account page (switching it on). docs/MFA.md
async function Flow({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Not requireUser(): that sends a pending second step here.
  if (!(await getCurrentUser())) redirect("/auth/login");
  const { next } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_admin_mfa_status");
  return <TwoStepFlow next={safeRedirectPath(next)} adminRequired={data === "required"} />;
}

export default function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <Suspense>
      <Flow searchParams={searchParams} />
    </Suspense>
  );
}
