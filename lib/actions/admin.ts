"use server";

import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import type { AdminErrorKey } from "@/lib/admin/strings";
import { isRole } from "@/lib/auth/roles";
import { getSupabaseEnv } from "@/lib/env";
import { adminCompany, adminUser, requirePlatformAdmin } from "@/lib/data/admin";
import { localInputToIso } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/common";

// Platform-admin mutations. The database functions check is_platform_admin(), enforce the
// normal rules (e.g. the last owner) and write the admin audit log; these actions add the
// deliberate typed confirmation for the high-impact ones. Nothing here can read or set a
// password, see a token or sign in as someone else.

export type AdminActionState = { ok?: boolean; error?: AdminErrorKey };

function errorKey(error: { code?: string; message?: string } | null): AdminErrorKey {
  if (!error) return "unknown";
  if (error.code === "P0002") return "not_found";
  if (error.message === "last_owner") return "last_owner";
  if (error.code === "42501") return "forbidden";
  return "unknown";
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Typed confirmation for destructive actions: the user's email, checked on the server. */
async function confirmedEmail(userId: string, formData: FormData) {
  const detail = await adminUser(userId);
  const typed = text(formData, "confirmation").toLowerCase();
  return detail.account.email !== null && typed === detail.account.email.toLowerCase() ? detail : null;
}

export async function adminSetMemberRole(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePlatformAdmin();
  const membership = uuid.safeParse(text(formData, "membershipId"));
  const role = text(formData, "role");
  if (!membership.success || !isRole(role)) return { error: "unknown" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_member_role", { p_membership: membership.data, p_role: role });
  if (error) return { error: errorKey(error) };
  refresh();
  return { ok: true };
}

export async function adminRemoveMember(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePlatformAdmin();
  const membership = uuid.safeParse(text(formData, "membershipId"));
  const user = uuid.safeParse(text(formData, "userId"));
  if (!membership.success || !user.success) return { error: "unknown" };
  const detail = await confirmedEmail(user.data, formData);
  if (!detail) return { error: "confirmation" };
  if (!detail.memberships.some((m) => m.membership_id === membership.data)) return { error: "not_found" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_member", { p_membership: membership.data });
  if (error) return { error: errorKey(error) };
  refresh();
  return { ok: true };
}

export async function adminSetUserDisabled(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const me = await requirePlatformAdmin();
  const user = uuid.safeParse(text(formData, "userId"));
  const disabled = text(formData, "disabled") === "true";
  if (!user.success) return { error: "unknown" };
  if (user.data === me.id) return { error: "forbidden" };
  if (disabled && !(await confirmedEmail(user.data, formData))) return { error: "confirmation" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_disabled", { p_user: user.data, p_disabled: disabled });
  if (error) return { error: errorKey(error) };
  refresh();
  return { ok: true };
}

export async function adminRevokeSessions(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePlatformAdmin();
  const user = uuid.safeParse(text(formData, "userId"));
  if (!user.success) return { error: "unknown" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_revoke_sessions", { p_user: user.data });
  if (error) return { error: errorKey(error) };
  refresh();
  return { ok: true };
}

/**
 * Sends Supabase Auth's ordinary password-recovery email to the user's own confirmed
 * address (the database records the request in the admin log first). The admin never
 * sees a link, token or password.
 */
export async function adminSendPasswordReset(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePlatformAdmin();
  const user = uuid.safeParse(text(formData, "userId"));
  if (!user.success) return { error: "unknown" };
  const supabase = await createClient();
  const { data: email, error } = await supabase.rpc("admin_password_reset_target", { p_user: user.data });
  if (error || !email) return { error: errorKey(error) };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  const { url, publishableKey } = getSupabaseEnv();
  const mailer = createStatelessClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "pkce" },
  });
  const { error: sendError } = await mailer.auth.resetPasswordForEmail(email, {
    redirectTo: `${proto}://${host}/auth/confirm?next=/auth/update-password`,
  });
  if (sendError) return { error: "unknown" };
  return { ok: true };
}

const DAY = 86_400_000;

/** "Pikenda prooviperioodi": +7 / +14 / +30 days from the current end (or now), or a date. */
export async function adminExtendTrial(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePlatformAdmin();
  const org = uuid.safeParse(text(formData, "companyId"));
  const extend = text(formData, "extend");
  if (!org.success) return { error: "unknown" };
  let until: string;
  if (["7", "14", "30"].includes(extend)) {
    const current = Date.parse(text(formData, "currentEnd"));
    const base = Number.isFinite(current) ? Math.max(current, Date.now()) : Date.now();
    until = new Date(base + Number(extend) * DAY).toISOString();
  } else if (extend === "custom") {
    const day = text(formData, "until");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "invalid_date" };
    until = endOfTallinnDay(day);
  } else {
    return { error: "unknown" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_extend_trial", { p_org: org.data, p_trial_ends_at: until });
  if (error) return { error: error.code === "22023" ? "invalid_date" : errorKey(error) };
  refresh();
  return { ok: true };
}

export async function adminExpireAccess(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePlatformAdmin();
  const org = uuid.safeParse(text(formData, "companyId"));
  if (!org.success) return { error: "unknown" };
  const detail = await adminCompany(org.data);
  if (text(formData, "confirmation") !== detail.company.name) return { error: "confirmation" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_expire_access", { p_org: org.data });
  if (error) return { error: errorKey(error) };
  refresh();
  return { ok: true };
}

export async function adminSetAccessReference(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePlatformAdmin();
  const org = uuid.safeParse(text(formData, "companyId"));
  if (!org.success) return { error: "unknown" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_access_reference", {
    p_org: org.data,
    p_invoice_reference: text(formData, "invoiceReference").slice(0, 200),
    p_notes: text(formData, "notes").slice(0, 2000),
  });
  if (error) return { error: errorKey(error) };
  refresh();
  return { ok: true };
}

/** 23:59:59 in Tallinn on the given day, as an ISO timestamp. */
function endOfTallinnDay(day: string) {
  const iso = localInputToIso(`${day}T23:59`);
  return iso ? new Date(Date.parse(iso) + 59_000).toISOString() : `${day}T21:59:59Z`;
}

// ---------------------------------------------------------------------------
// Subscriptions (Tellimused): preview first, then apply what was confirmed
// ---------------------------------------------------------------------------

export type SubscriptionPreview = {
  mode: "activate" | "extend" | "set_until" | "plan_only";
  plan: string;
  plan_label: string | null;
  monthly_price: number;
  user_limit: number;
  installation_limit: number;
  months: number | null;
  start: string | null;
  paid_until: string | null;
  previous_paid_until: string | null;
  seats_used: number;
  installations_active: number;
};
export type SubscriptionState = AdminActionState & { preview?: SubscriptionPreview; applied?: boolean };

const SUB_PLANS = ["start", "team", "pro", "business", "custom"];
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function subscriptionArgs(formData: FormData) {
  const org = uuid.safeParse(text(formData, "companyId"));
  const plan = text(formData, "plan");
  const period = text(formData, "period");
  if (!org.success || !SUB_PLANS.includes(plan) || !["none", "1", "3", "6", "12", "24", "date"].includes(period)) return null;
  const until = text(formData, "paidUntil");
  const start = text(formData, "start");
  if (period === "date" && !DAY_PATTERN.test(until)) return null;
  if (start && !DAY_PATTERN.test(start)) return null;
  const number = (name: string) => {
    const raw = text(formData, name).replace(",", ".");
    return raw === "" ? null : Number(raw);
  };
  const custom = plan === "custom";
  return {
    p_org: org.data,
    p_plan: plan,
    p_label: custom ? text(formData, "label").slice(0, 60) || null : null,
    p_price: custom ? number("price") : null,
    p_user_limit: custom ? number("userLimit") : null,
    p_installation_limit: custom ? number("installationLimit") : null,
    p_months: ["1", "3", "6", "12", "24"].includes(period) ? Number(period) : null,
    p_paid_until: period === "date" ? until : null,
    p_start: start || null,
  };
}

function subscriptionError(error: { code?: string; message?: string }): SubscriptionState {
  if (error.code === "22023" || error.code === "22P02" || error.code === "23514") return { error: "invalid_subscription" };
  return { error: errorKey(error) };
}

/** "Vaata üle": the database calculates the result without saving anything. */
export async function adminPreviewSubscription(_prev: SubscriptionState, formData: FormData): Promise<SubscriptionState> {
  await requirePlatformAdmin();
  const args = subscriptionArgs(formData);
  if (!args) return { error: "invalid_subscription" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_subscription_preview", args as never);
  if (error) return subscriptionError(error);
  return { preview: data as SubscriptionPreview };
}

/**
 * "Kinnita ja rakenda": saves exactly what was previewed. If the result would now differ
 * (e.g. someone else changed the subscription meanwhile), nothing is saved.
 */
export async function adminApplySubscription(_prev: SubscriptionState, formData: FormData): Promise<SubscriptionState> {
  await requirePlatformAdmin();
  const args = subscriptionArgs(formData);
  if (!args) return { error: "invalid_subscription" };
  const supabase = await createClient();
  const { data: check, error: checkError } = await supabase.rpc("admin_subscription_preview", args as never);
  if (checkError) return subscriptionError(checkError);
  const expected = text(formData, "expected");
  const current = check as SubscriptionPreview;
  if (expected !== `${current.mode}|${current.paid_until ?? ""}|${current.user_limit}|${current.installation_limit}`) {
    return { error: "stale" };
  }
  const { error } = await supabase.rpc("admin_set_subscription", args as never);
  if (error) return subscriptionError(error);
  refresh();
  return { ok: true, applied: true };
}
