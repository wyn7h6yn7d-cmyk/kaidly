import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isUuid, type InstallationStatus, type InstallationType } from "@/lib/validation/sites";

// Every query runs as the user (RLS) and is additionally scoped to the organisation from
// the URL, so a record id from another organisation — even one the user could see
// elsewhere — never renders under the wrong organisation.

export type SiteListItem = {
  id: string;
  name: string;
  address: string | null;
  responsiblePerson: string | null;
  archivedAt: string | null;
  installationCount: number;
};

export async function listSites(
  organisationId: string,
  { archived = false }: { archived?: boolean } = {},
): Promise<SiteListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("sites")
    .select("id, name, address, responsible_person, archived_at, electrical_installations(count)")
    .eq("organisation_id", organisationId)
    .is("electrical_installations.archived_at", null)
    .order("name");
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  const { data, error } = await query;
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    responsiblePerson: row.responsible_person,
    archivedAt: row.archived_at,
    installationCount: row.electrical_installations[0]?.count ?? 0,
  }));
}

export async function countArchivedSites(organisationId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("sites")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", organisationId)
    .not("archived_at", "is", null);
  if (error) throw error;
  return count ?? 0;
}

export type Site = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  responsiblePerson: string | null;
  archivedAt: string | null;
};

export const getSite = cache(async (organisationId: string, siteId: string): Promise<Site | null> => {
  if (!isUuid(siteId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .select("id, name, address, description, responsible_person, archived_at")
    .eq("organisation_id", organisationId)
    .eq("id", siteId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    address: data.address,
    description: data.description,
    responsiblePerson: data.responsible_person,
    archivedAt: data.archived_at,
  };
});

export type InstallationListItem = {
  id: string;
  name: string;
  identifier: string | null;
  installationType: InstallationType;
  location: string | null;
  status: InstallationStatus;
  archivedAt: string | null;
};

export async function listSiteInstallations(
  organisationId: string,
  siteId: string,
): Promise<InstallationListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("electrical_installations")
    .select("id, name, identifier, installation_type, location, status, archived_at")
    .eq("organisation_id", organisationId)
    .eq("site_id", siteId)
    .order("name");
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    identifier: row.identifier,
    installationType: row.installation_type,
    location: row.location,
    status: row.status,
    archivedAt: row.archived_at,
  }));
}

export type Installation = InstallationListItem & {
  description: string | null;
  commissionedOn: string | null;
  responsiblePerson: string | null;
  notes: string | null;
  site: { id: string; name: string; archivedAt: string | null };
};

export const getInstallation = cache(
  async (organisationId: string, installationId: string): Promise<Installation | null> => {
    if (!isUuid(installationId)) return null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("electrical_installations")
      .select(
        "id, name, identifier, installation_type, location, description, commissioned_on, status, responsible_person, notes, archived_at, site:sites!inner(id, name, archived_at)",
      )
      .eq("organisation_id", organisationId)
      .eq("id", installationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      identifier: data.identifier,
      installationType: data.installation_type,
      location: data.location,
      description: data.description,
      commissionedOn: data.commissioned_on,
      status: data.status,
      responsiblePerson: data.responsible_person,
      notes: data.notes,
      archivedAt: data.archived_at,
      site: { id: data.site.id, name: data.site.name, archivedAt: data.site.archived_at },
    };
  },
);

/** Active sites for the "site" select in installation forms. */
export async function listActiveSiteOptions(
  organisationId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .select("id, name")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

export async function getOverviewCounts(
  organisationId: string,
): Promise<{ sites: number; installations: number }> {
  const supabase = await createClient();
  const [sites, installations] = await Promise.all([
    supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .is("archived_at", null),
    supabase
      .from("electrical_installations")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .is("archived_at", null),
  ]);
  if (sites.error) throw sites.error;
  if (installations.error) throw installations.error;
  return { sites: sites.count ?? 0, installations: installations.count ?? 0 };
}
