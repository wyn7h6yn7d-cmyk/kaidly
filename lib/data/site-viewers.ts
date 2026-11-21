import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/sites";

// Objekti vaataja (docs/SITE_VIEWERS.md). Everything here reads through the user's own
// session: RLS (private.viewer_site_ids) decides every row — no definer read of content.

export type ViewerSite = { organisationId: string; organisationName: string; siteId: string; siteName: string };

/** The signed-in user's viewable sites (active grant, company active and paid). */
export const getMySiteAccess = cache(async (): Promise<ViewerSite[]> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_site_access");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    organisationId: r.organisation_id,
    organisationName: r.organisation_name,
    siteId: r.site_id,
    siteName: r.site_name,
  }));
});

export const LOG_PAGE_SIZE = 50;

/** One site as the viewer sees it, or null (unknown, foreign, revoked or not active). */
export async function getViewerSite(siteId: string, logPage = 0) {
  if (!isUuid(siteId)) return null;
  const access = (await getMySiteAccess()).find((s) => s.siteId === siteId);
  if (!access) return null;
  const supabase = await createClient();
  const page = Math.max(0, Math.min(logPage, 10_000));
  const [site, installations, plan, log, deficiencies, documents, archived] = await Promise.all([
    supabase.from("sites").select("id, name, address, responsible_person").eq("id", siteId).maybeSingle(),
    supabase
      .from("electrical_installations")
      .select("id, name, identifier, installation_type, status")
      .eq("site_id", siteId)
      .is("archived_at", null)
      .order("name")
      .order("id"),
    supabase
      .from("scheduled_activities")
      .select("id, title, next_due_on, electrical_installation_id, responsible_person_name")
      .eq("site_id", siteId)
      .is("archived_at", null)
      .not("next_due_on", "is", null)
      .order("next_due_on")
      .order("id")
      .limit(200),
    supabase
      .from("log_entries")
      .select("id, occurred_at, entry_type, description, result, created_by_name, performed_by_name, correction_of_id, correction_reason, electrical_installation_id")
      .eq("site_id", siteId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .range(page * LOG_PAGE_SIZE, page * LOG_PAGE_SIZE + LOG_PAGE_SIZE),
    supabase
      .from("deficiencies")
      .select("id, title, severity, status, detected_at, due_on, resolution, resolved_at, electrical_installation_id")
      .eq("site_id", siteId)
      .order("detected_at", { ascending: false })
      .order("id")
      .limit(500),
    supabase
      .from("documents")
      .select("id, title, category, external_url, electrical_installation_id")
      .eq("site_id", siteId)
      .not("external_url", "is", null)
      .is("archived_at", null)
      .order("title")
      .order("id")
      .limit(500),
    supabase
      .from("electrical_installations")
      .select("id, name, identifier")
      .eq("site_id", siteId)
      .not("archived_at", "is", null)
      .order("name")
      .order("id"),
  ]);
  for (const r of [site, installations, plan, log, deficiencies, documents, archived]) if (r.error) throw r.error;
  if (!site.data) return null;
  const logRows = log.data ?? [];
  return {
    access,
    site: site.data,
    installations: installations.data ?? [],
    plan: plan.data ?? [],
    log: logRows.slice(0, LOG_PAGE_SIZE),
    logPage: page,
    logHasMore: logRows.length > LOG_PAGE_SIZE,
    deficiencies: deficiencies.data ?? [],
    documents: documents.data ?? [],
    archivedInstallations: archived.data ?? [],
  };
}

export type SiteViewersOverview = {
  viewers: { id: string; name: string | null; email: string | null; since: string }[];
  invitations: { id: string; email: string; expiresAt: string }[];
};

/** Owners/admins: active viewers and live invitations of a site (null when not allowed). */
export async function getSiteViewersOverview(siteId: string): Promise<SiteViewersOverview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("site_viewers_overview", { p_site_id: siteId });
  if (error) return null;
  const value = data as {
    viewers?: { id: string; name: string | null; email: string | null; since: string }[];
    invitations?: { id: string; email: string; expires_at: string }[];
  } | null;
  return {
    viewers: value?.viewers ?? [],
    invitations: (value?.invitations ?? []).map((i) => ({ id: i.id, email: i.email, expiresAt: i.expires_at })),
  };
}

export type ViewerInvitationPreview =
  | { status: "valid"; organisationName: string; sites: string[]; expiresAt: string; emailMatches: boolean }
  | { status: "invalid" | "expired" | "used" | "revoked" };

export async function previewSiteViewerInvitation(token: string): Promise<ViewerInvitationPreview> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { status: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("site_viewer_invitation_preview", { p_token: token });
  if (error) throw error;
  const p = data as Record<string, unknown> | null;
  if (p?.status === "valid") {
    return {
      status: "valid",
      organisationName: String(p.organisation_name),
      sites: Array.isArray(p.sites) ? p.sites.map(String) : [],
      expiresAt: String(p.expires_at),
      emailMatches: p.email_matches === true,
    };
  }
  if (p?.status === "expired" || p?.status === "used" || p?.status === "revoked") return { status: p.status };
  return { status: "invalid" };
}
