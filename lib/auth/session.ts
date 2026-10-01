import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string | null;
};

/**
 * The signed-in user, or null. Reads the session cookie, so call it inside a
 * <Suspense> boundary (Cache Components). The profile is read through RLS.
 * Deduplicated per request with React `cache`, so layouts and pages can all call it.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;

  const id = data.claims.sub;
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", id)
    .maybeSingle();

  return {
    id,
    email: profile?.email ?? data.claims.email ?? null,
    fullName: profile?.full_name ?? null,
  };
});

/** Like getCurrentUser, but redirects to login when there is no session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  return user;
}
