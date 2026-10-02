import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { isRole, type Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type Organisation = {
  id: string;
  name: string;
  slug: string;
  registryCode: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
  /** Set when an owner deactivated the organisation: read-only, kept for its history. */
  deactivatedAt: string | null;
};

export type OrgContext = {
  user: CurrentUser;
  org: Organisation;
  role: Role;
};

export type MyOrganisation = Pick<Organisation, "id" | "name" | "slug" | "deactivatedAt"> & { role: Role };

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** All organisations the current user belongs to, with their role. */
export const listMyOrganisations = cache(async (): Promise<MyOrganisation[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisation_members")
    .select("role, organisations!inner(id, name, slug, deactivated_at)")
    .eq("user_id", user.id);
  if (error) throw error;

  return data
    .map((row) => ({
      id: row.organisations.id,
      name: row.organisations.name,
      slug: row.organisations.slug,
      deactivatedAt: row.organisations.deactivated_at,
      role: row.role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "et"));
});

/**
 * The organisation behind a URL slug and the current user's role in it, or null.
 * RLS returns nothing for organisations the user doesn't belong to, so "doesn't exist"
 * and "not a member" are indistinguishable — on purpose.
 */
export const getOrgContext = cache(async (slug: string): Promise<OrgContext | null> => {
  if (!SLUG_PATTERN.test(slug) || slug.length > 60) return null;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: org, error } = await supabase
    .from("organisations")
    .select("id, name, slug, registry_code, contact_email, contact_phone, address, notes, deactivated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!org) return null;

  const { data: membership, error: memberError } = await supabase
    .from("organisation_members")
    .select("role")
    .eq("organisation_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!membership || !isRole(membership.role)) return null;

  return {
    user,
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      registryCode: org.registry_code,
      contactEmail: org.contact_email,
      contactPhone: org.contact_phone,
      address: org.address,
      notes: org.notes,
      deactivatedAt: org.deactivated_at,
    },
    role: membership.role,
  };
});

/** Like getOrgContext, but renders the not-found page when there is no access. */
export async function requireOrg(slug: string): Promise<OrgContext> {
  const ctx = await getOrgContext(slug);
  if (!ctx) notFound();
  return ctx;
}

export type Member = {
  id: string;
  userId: string;
  role: Role;
  fullName: string | null;
  email: string | null;
  joinedAt: string;
};

export async function listMembers(organisationId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisation_members")
    .select("id, user_id, role, created_at, profile:profiles!organisation_members_user_id_fkey(full_name, email)")
    .eq("organisation_id", organisationId);
  if (error) throw error;

  const order: Record<Role, number> = { owner: 0, admin: 1, operator: 2, viewer: 3 };
  return data
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      role: row.role,
      fullName: row.profile?.full_name ?? null,
      email: row.profile?.email ?? null,
      joinedAt: row.created_at,
    }))
    .sort(
      (a, b) =>
        order[a.role] - order[b.role] ||
        (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? "", "et"),
    );
}

export type PendingInvitation = {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
};

/** Live invitations (admins only — RLS returns nothing to other roles). */
export async function listPendingInvitations(organisationId: string): Promise<PendingInvitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisation_invitations")
    .select("id, email, role, expires_at")
    .eq("organisation_id", organisationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at,
  }));
}

export type InvitationPreview =
  | { status: "invalid" | "expired" | "used" | "revoked" }
  | {
      status: "valid";
      organisationName: string;
      role: Role;
      expiresAt: string;
      emailMatches: boolean;
      alreadyMember: boolean;
      organisationSlug: string | null;
    };

export async function previewInvitation(token: string): Promise<InvitationPreview> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { status: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invitation_preview", { p_token: token });
  if (error) throw error;

  const preview = data as Record<string, unknown> | null;
  const status = preview?.status;
  if (status === "valid" && isRole(preview?.role)) {
    return {
      status,
      organisationName: String(preview.organisation_name),
      role: preview.role,
      expiresAt: String(preview.expires_at),
      emailMatches: preview.email_matches === true,
      alreadyMember: preview.already_member === true,
      organisationSlug: typeof preview.organisation_slug === "string" ? preview.organisation_slug : null,
    };
  }
  if (status === "expired" || status === "used" || status === "revoked") return { status };
  return { status: "invalid" };
}

/** What deleting the organisation would affect — shown before the owner decides. */
export async function getLifecycleFacts(organisationId: string) {
  const supabase = await createClient();
  const count = (table: "log_entries" | "deficiencies" | "documents" | "organisation_members") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("organisation_id", organisationId);
  const [entries, deficiencies, documents, members] = await Promise.all([
    count("log_entries"),
    count("deficiencies"),
    count("documents"),
    count("organisation_members"),
  ]);
  for (const r of [entries, deficiencies, documents, members]) if (r.error) throw r.error;
  const facts = {
    entries: entries.count ?? 0,
    deficiencies: deficiencies.count ?? 0,
    documents: documents.count ?? 0,
    members: members.count ?? 0,
  };
  // Mirrors the database rule in delete_organisation(); the database decides.
  return { ...facts, hasHistory: facts.entries + facts.deficiencies + facts.documents > 0 };
}
