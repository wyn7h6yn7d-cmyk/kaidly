import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Platform administration reads. Every call goes through a security definer function that
// checks private.is_platform_admin() in the database and answers 'not_found' to anyone
// else; the checks here only decide what to render. No service-role key is involved.

/** Is the signed-in user a KAIDLY platform admin? Database-backed, never an email check. */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("am_platform_admin");
  return !error && data === true;
});

/** For /admin pages: anyone who isn't a platform admin gets the ordinary 404. */
export async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!(await isPlatformAdmin())) notFound();
  return user;
}

async function call<T>(fn: Parameters<Awaited<ReturnType<typeof createClient>>["rpc"]>[0], args?: object): Promise<T> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args as never);
  if (error) {
    if (error.code === "P0002") notFound();
    throw error;
  }
  return data as T;
}

export type AdminOverview = Record<
  | "users" | "users_active_30d" | "companies" | "companies_active" | "companies_deactivated" | "sites" | "installations"
  | "activities_overdue" | "activities_due_soon" | "deficiencies_open" | "deficiencies_serious" | "documents"
  | "storage_bytes" | "log_entries_30d",
  number
>;

export type AdminMembershipSummary = { company_id: string; company: string; role: string; deactivated: boolean };
export type AdminUserRow = {
  id: string;
  email: string | null;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  disabled: boolean;
  full_name: string | null;
  preferred_locale: string | null;
  platform_admin: boolean;
  memberships: AdminMembershipSummary[];
};
export type AdminUserDetail = {
  account: Omit<AdminUserRow, "memberships"> & { phone: string | null };
  memberships: (AdminMembershipSummary & { membership_id: string; slug: string; joined_at: string })[];
  usage: Record<"log_entries" | "activities_completed" | "deficiencies_created" | "deficiencies_resolved" | "documents_uploaded", number>;
  recent: { created_at: string; table_name: string; action: string; company: string }[];
};
export type AdminCompanyRow = {
  id: string;
  name: string;
  slug: string;
  registry_code: string | null;
  created_at: string;
  deactivated_at: string | null;
  owners: string[];
  members: number;
  sites: number;
  installations: number;
  overdue: number;
  open_deficiencies: number;
  documents: number;
};
export type AdminCompanyDetail = {
  company: {
    id: string;
    name: string;
    slug: string;
    registry_code: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
    created_at: string;
    deactivated_at: string | null;
  };
  members: { membership_id: string; user_id: string; name: string | null; email: string | null; role: string; joined_at: string }[];
  counts: Record<
    | "sites" | "installations" | "log_entries" | "activities" | "overdue" | "due_soon" | "deficiencies_open"
    | "deficiencies_serious" | "documents" | "storage_bytes",
    number
  >;
  recent: { created_at: string; table_name: string; action: string; actor: string | null }[];
};
export type AdminDeadline = {
  kind: "activity" | "deficiency";
  id: string;
  company_id: string;
  company: string;
  company_deactivated: boolean;
  site_id: string;
  site: string;
  installation: string;
  identifier: string | null;
  item: string;
  severity: "high" | "critical" | null;
  due_on: string | null;
  days: number | null;
  responsible: string | null;
  state: "overdue" | "soon" | "open";
};
export type AdminDeadlineFilters = {
  company?: string;
  site?: string;
  kind?: "activity" | "deficiency";
  severity?: "high" | "critical";
  state?: "overdue" | "soon";
  from?: string;
  to?: string;
  includeDeactivated?: boolean;
};
export type AdminSystem = Record<
  "migrations" | "users" | "companies" | "documents" | "pending_uploads" | "storage_bytes" | "platform_admins",
  number
> & { latest_migration: string | null };
export type AdminAuditEntry = {
  id: number;
  created_at: string;
  action: string;
  target_type: string;
  target_id: string | null;
  summary: Record<string, unknown>;
  admin: string | null;
};

export const PAGE_SIZE = 50;

export const adminOverview = () => call<AdminOverview>("admin_overview");
export const adminUsers = (search: string | undefined, page: number) =>
  call<{ total: number; rows: AdminUserRow[] }>("admin_users", {
    p_search: search ?? null,
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  });
export const adminUser = (id: string) => call<AdminUserDetail>("admin_user", { p_user: id });
export const adminCompanies = (search: string | undefined, page: number) =>
  call<{ total: number; rows: AdminCompanyRow[] }>("admin_companies", {
    p_search: search ?? null,
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  });
export const adminCompany = (id: string) => call<AdminCompanyDetail>("admin_company", { p_org: id });
export const adminDeadlines = (f: AdminDeadlineFilters) =>
  call<{ today: string; rows: AdminDeadline[] }>("admin_deadlines", {
    p_company: f.company ?? null,
    p_kind: f.kind ?? null,
    p_severity: f.severity ?? null,
    p_state: f.state ?? null,
    p_from: f.from ?? null,
    p_to: f.to ?? null,
    p_include_deactivated: f.includeDeactivated ?? false,
    p_site: f.site ?? null,
  });
export const adminSystem = () => call<AdminSystem>("admin_system");
export const adminAudit = (page: number) =>
  call<AdminAuditEntry[]>("admin_audit_entries", { p_limit: 100, p_offset: page * 100 });
export const adminCompanyOptions = async () =>
  (await call<{ total: number; rows: AdminCompanyRow[] }>("admin_companies", { p_search: null, p_limit: 200, p_offset: 0 })).rows.map(
    (c) => ({ id: c.id, name: c.name, deactivated: c.deactivated_at !== null }),
  );
