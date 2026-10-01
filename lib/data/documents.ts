import "server-only";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/documents/rules";
import { createClient } from "@/lib/supabase/server";
import { localInputToIso } from "@/lib/time";
import { isUuid } from "@/lib/validation/sites";

export const DOCUMENTS_PAGE_SIZE = 50;

/** A ready document as listed. Pending and failed uploads are never listed. */
export type DocumentItem = {
  id: string;
  title: string;
  category: DocumentCategory;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string;
  createdAt: string;
  archivedAt: string | null;
  siteId: string | null;
  installationId: string | null;
  logEntryId: string | null;
  deficiencyId: string | null;
};

const COLUMNS =
  "id, title, category, original_filename, mime_type, size_bytes, uploaded_by_name, created_at, archived_at, site_id, electrical_installation_id, log_entry_id, deficiency_id";

type Row = {
  id: string;
  title: string;
  category: DocumentCategory;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by_name: string;
  created_at: string;
  archived_at: string | null;
  site_id: string | null;
  electrical_installation_id: string | null;
  log_entry_id: string | null;
  deficiency_id: string | null;
};

function toItem(row: Row): DocumentItem {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedByName: row.uploaded_by_name,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    siteId: row.site_id,
    installationId: row.electrical_installation_id,
    logEntryId: row.log_entry_id,
    deficiencyId: row.deficiency_id,
  };
}

export type DocumentFilters = {
  siteId?: string;
  installationId?: string;
  category?: DocumentCategory;
  from?: string; // YYYY-MM-DD, Tallinn
  to?: string; // inclusive
  archived?: boolean;
  /** Only documents of the site itself, not of its installations (site page). */
  siteLevelOnly?: boolean;
};

/** Reads ?objekt, ?paigaldis, ?liik, ?alates, ?kuni, ?arhiiv; ignores anything malformed. */
export function parseDocumentFilters(params: Record<string, string | string[] | undefined>): DocumentFilters {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const date = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);
  const category = one("liik");
  return {
    siteId: isUuid(one("objekt") ?? "") ? one("objekt") : undefined,
    installationId: isUuid(one("paigaldis") ?? "") ? one("paigaldis") : undefined,
    category: (DOCUMENT_CATEGORIES as readonly string[]).includes(category ?? "")
      ? (category as DocumentCategory)
      : undefined,
    from: date(one("alates")),
    to: date(one("kuni")),
    archived: one("arhiiv") === "1" || undefined,
  };
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type DocumentPage = { items: DocumentItem[]; hasMore: boolean; page: number };

/** Ready documents, newest first, with a deterministic tie-break. */
export async function listDocuments(
  organisationId: string,
  filters: DocumentFilters,
  page = 1,
): Promise<DocumentPage> {
  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select(COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("status", "ready");
  query = filters.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (filters.siteId) query = query.eq("site_id", filters.siteId);
  if (filters.siteLevelOnly) query = query.is("electrical_installation_id", null);
  if (filters.installationId) query = query.eq("electrical_installation_id", filters.installationId);
  if (filters.category) query = query.eq("category", filters.category);
  const fromIso = filters.from ? localInputToIso(`${filters.from}T00:00`) : null;
  const toIso = filters.to ? localInputToIso(`${nextDay(filters.to)}T00:00`) : null;
  if (fromIso) query = query.gte("created_at", fromIso);
  if (toIso) query = query.lt("created_at", toIso);

  const from = (page - 1) * DOCUMENTS_PAGE_SIZE;
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + DOCUMENTS_PAGE_SIZE); // one extra row tells whether there is more
  if (error) throw error;
  return {
    items: data.slice(0, DOCUMENTS_PAGE_SIZE).map(toItem),
    hasMore: data.length > DOCUMENTS_PAGE_SIZE,
    page,
  };
}

/** Ready attachments of some log entries (an entry and its corrections) or of a deficiency. */
export async function listAttachments(
  organisationId: string,
  target: { logEntryIds: string[] } | { deficiencyId: string },
): Promise<DocumentItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select(COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("status", "ready");
  query =
    "logEntryIds" in target
      ? query.in("log_entry_id", target.logEntryIds)
      : query.eq("deficiency_id", target.deficiencyId);
  const { data, error } = await query
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(100);
  if (error) throw error;
  return data.map(toItem);
}

/** A ready document of the organisation (null for unknown, foreign or incomplete). */
export async function getDocument(organisationId: string, documentId: string): Promise<DocumentItem | null> {
  if (!isUuid(documentId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("id", documentId)
    .eq("status", "ready")
    .maybeSingle();
  if (error) throw error;
  return data ? toItem(data) : null;
}

/**
 * Signs a short-lived URL for a ready document. The storage read policy only allows
 * objects of ready documents the caller can see, so this fails for anything else.
 */
export async function signDocumentUrl(
  organisationId: string,
  documentId: string,
  { download }: { download: boolean },
): Promise<string | null> {
  if (!isUuid(documentId)) return null;
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .select("storage_path, original_filename")
    .eq("organisation_id", organisationId)
    .eq("id", documentId)
    .eq("status", "ready")
    .maybeSingle();
  if (error || !doc) return null;
  const { data } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 60, download ? { download: doc.original_filename } : undefined);
  return data?.signedUrl ?? null;
}

/** Where a document belongs, for links on its page. */
export async function getDocumentPlacement(
  organisationId: string,
  doc: DocumentItem,
): Promise<{ siteName: string | null; logEntryOriginalId: string | null }> {
  const supabase = await createClient();
  const [site, entry] = await Promise.all([
    doc.siteId
      ? supabase.from("sites").select("name").eq("organisation_id", organisationId).eq("id", doc.siteId).maybeSingle()
      : null,
    doc.logEntryId
      ? supabase
          .from("log_entries")
          .select("id, correction_of_id")
          .eq("organisation_id", organisationId)
          .eq("id", doc.logEntryId)
          .maybeSingle()
      : null,
  ]);
  return {
    siteName: site?.data?.name ?? null,
    logEntryOriginalId: entry?.data ? (entry.data.correction_of_id ?? entry.data.id) : null,
  };
}
