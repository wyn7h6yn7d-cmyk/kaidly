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

/** Step data of the password change: set when Supabase asked for a reauthentication code. */
export type PasswordChangeData = { reauth: true; sent: boolean };

const NONCE = /^\d{6,10}$/;

/**
 * Changes the signed-in user's password. The current password is required: it is checked
 * by signing in once with a throw-away client that keeps no session (that check session
 * is signed out again immediately). Afterwards every other device is signed out.
 *
 * Secure password change (Supabase Auth setting): when the session is older than 24 hours,
 * Supabase refuses the change with `reauthentication_needed`. We then ask Supabase to send
 * its reauthentication code (KAIDLY "reauthentication" e-mail) and return the code step;
 * the form submits again with `nonce`, which Supabase verifies inside updateUser. KAIDLY
 * never creates, stores or logs the code.
 */
export async function changePassword(
  _prev: ActionState<PasswordChangeData>,
  formData: FormData,
): Promise<ActionState<PasswordChangeData>> {
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
  const rawNonce = formData.get("nonce");
  const nonce = typeof rawNonce === "string" && rawNonce.trim() !== "" ? rawNonce.trim() : undefined;
  if (nonce !== undefined && !NONCE.test(nonce)) {
    return { ...failure("reauth_code_invalid", { nonce: true }), data: { reauth: true, sent: false } };
  }

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
  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword, ...(nonce ? { nonce } : {}) });
  if (error?.code === "reauthentication_needed" || error?.code === "reauth_nonce_missing") {
    const { error: sendError } = await supabase.auth.reauthenticate();
    if (sendError) return { ...failure(authErrorCode(sendError)), data: { reauth: true, sent: false } };
    return { ok: false, data: { reauth: true, sent: true } };
  }
  if (error?.code === "reauthentication_not_valid") {
    return { ...failure("reauth_code_invalid", { nonce: true }), data: { reauth: true, sent: false } };
  }
  if (error) return failure(authErrorCode(error), { newPassword: true });
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true };
}

/** Sends a new reauthentication code (Supabase rate-limits this; mapped to `rate_limited`). */
export async function resendReauthCode(): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.reauthenticate();
  if (error) return failure(authErrorCode(error));
  return { ok: true };
}

/**
 * The signed-in user's own deadline-reminder e-mail preference (RLS: own row only; no row
 * means on). Never touches Auth/security e-mails. Turning it off also cancels unsent
 * reminder e-mails (database trigger).
 */
export async function setDeadlineEmails(
  _prev: ActionState<{ enabled: boolean }>,
  formData: FormData,
): Promise<ActionState<{ enabled: boolean }>> {
  const user = await requireUser();
  const raw = formData.get("enabled");
  const previous = formData.get("previous") !== "false";
  if (raw !== "true" && raw !== "false") return { ...failure("invalid_input"), data: { enabled: previous } };
  const enabled = raw === "true";

  const supabase = await createClient();
  const update = () =>
    supabase.from("notification_preferences").update({ email_deadline_reminders: enabled }).eq("user_id", user.id).select("user_id");
  let { data, error } = await update();
  if (!error && !data?.length) {
    const inserted = await supabase.from("notification_preferences").insert({ user_id: user.id, email_deadline_reminders: enabled });
    // A parallel request may have created the row first: then update it.
    if (inserted.error?.code === "23505") {
      ({ data, error } = await update());
    } else {
      error = inserted.error;
      data = inserted.error ? null : [{ user_id: user.id }];
    }
  }
  if (error || !data?.length) return { ...failure("unknown"), data: { enabled: previous } };
  return { ok: true, data: { enabled } };
}

/** Signs out every other device and browser; this one stays signed in. */
export async function signOutOtherSessions(): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return failure(authErrorCode(error));
  return { ok: true };
}
