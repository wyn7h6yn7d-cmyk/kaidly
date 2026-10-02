"use server";

import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { authErrorCode } from "@/lib/auth/errors";
import { requireUser } from "@/lib/auth/session";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { passwordChangeSchema } from "@/lib/validation/account";
import { type ActionState, failure } from "./state";

// Credentials stay inside Supabase Auth. They arrive here only in the POST body of the
// Server Action, are never stored, logged, returned or put into a URL, and every failure
// is reported as an application error code.

/**
 * Changes the signed-in user's password. The current password is required: it is checked
 * by signing in once with a throw-away client that keeps no session (that check session
 * is signed out again immediately). Afterwards every other device is signed out.
 */
export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    if (issue === "mismatch") return failure("password_mismatch", { confirmPassword: true });
    if (issue === "weak") return failure("weak_password", { newPassword: true });
    if (issue === "same") return failure("same_password", { newPassword: true });
    return failure("invalid_input");
  }
  if (!user.email) return failure("forbidden");

  const { url, publishableKey } = getSupabaseEnv();
  const verifier = createStatelessClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: check, error: checkError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (checkError || check.user?.id !== user.id) {
    const code = authErrorCode(checkError);
    return failure(code === "invalid_credentials" ? "current_password_wrong" : code, { currentPassword: true });
  }
  await verifier.auth.signOut({ scope: "local" });

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return failure(authErrorCode(error), { newPassword: true });
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true };
}

/** Signs out every other device and browser; this one stays signed in. */
export async function signOutOtherSessions(): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return failure(authErrorCode(error));
  return { ok: true };
}
