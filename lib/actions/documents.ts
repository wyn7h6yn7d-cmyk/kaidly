"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbErrorCode } from "@/lib/db/errors";
import { DOCUMENT_CATEGORIES, LINK_CATEGORIES } from "@/lib/documents/rules";
import { createClient } from "@/lib/supabase/server";
import { field, optionalExternalUrl, requiredText } from "@/lib/validation/common";
import { actionContext } from "./context";
import { type ActionState, failure, invalidInput } from "./state";

// The document register (docs/DATABASE.md §5k): KAIDLY stores links, never files. A
// document's organisation, site and installation always come from the database (RLS),
// never from the client.

const LINK_MESSAGES = { url: "invalid_document_url" } as const;

/** "org", "site:<id>" or "inst:<id>" from the form. */
const scopeSchema = z.union([
  z.literal("org"),
  z.string().regex(/^site:[0-9a-f-]{36}$/),
  z.string().regex(/^inst:[0-9a-f-]{36}$/),
]);

const createSchema = z.object({
  scope: scopeSchema,
  title: requiredText(200),
  category: z.enum(LINK_CATEGORIES),
  externalUrl: optionalExternalUrl,
});

type Placement = { site_id: string | null; electrical_installation_id: string | null };

async function placementFor(organisationId: string, scope: string): Promise<Placement | null> {
  if (scope === "org") return { site_id: null, electrical_installation_id: null };
  const [kind, id] = scope.split(":");
  const supabase = await createClient();
  if (kind === "site") {
    const { data } = await supabase.from("sites").select("id").eq("organisation_id", organisationId).eq("id", id).maybeSingle();
    return data ? { site_id: data.id, electrical_installation_id: null } : null;
  }
  const { data } = await supabase
    .from("electrical_installations")
    .select("id, site_id")
    .eq("organisation_id", organisationId)
    .eq("id", id)
    .maybeSingle();
  return data ? { site_id: data.site_id, electrical_installation_id: data.id } : null;
}

/**
 * Adds a document to the register: title, category, placement and the external link.
 * Operators add installation documents; organisation and site documents are admin+ (the
 * database enforces the same rule).
 */
export async function createDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "operator");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const parsed = createSchema.safeParse({
    scope: field(formData, "scope"),
    title: field(formData, "title"),
    category: field(formData, "category"),
    externalUrl: field(formData, "externalUrl"),
  });
  if (!parsed.success) return invalidInput(parsed.error, LINK_MESSAGES);
  const { scope, title, category, externalUrl } = parsed.data;
  if (!externalUrl) return failure("document_link_required", { externalUrl: true });
  const placement = await placementFor(ctx.org.id, scope);
  if (!placement) return failure("not_found");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({ organisation_id: ctx.org.id, ...placement, title, category, external_url: externalUrl })
    .select("id")
    .single();
  if (error || !data) return failure(dbErrorCode(error));
  redirect(
    placement.electrical_installation_id
      ? `/o/${ctx.org.slug}/paigaldised/${placement.electrical_installation_id}/dokumendid?salvestatud=1`
      : `/o/${ctx.org.slug}/dokumendid?salvestatud=1`,
  );
}

const updateSchema = z.object({
  documentId: z.uuid(),
  title: requiredText(200),
  category: z.enum(DOCUMENT_CATEGORIES),
  externalUrl: optionalExternalUrl,
});

/**
 * Title, category and link of a general document (admins). A document without a file must
 * keep its link; a file uploaded earlier may get one (also after the file was deleted).
 */
export async function updateDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const parsed = updateSchema.safeParse({
    documentId: field(formData, "documentId"),
    title: field(formData, "title"),
    category: field(formData, "category"),
    externalUrl: field(formData, "externalUrl"),
  });
  if (!parsed.success) return invalidInput(parsed.error, LINK_MESSAGES);
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("organisation_id", access.ctx.org.id)
    .eq("id", parsed.data.documentId)
    .maybeSingle();
  if (!doc) return failure("not_found");
  if (!doc.storage_path && !parsed.data.externalUrl) return failure("document_link_required", { externalUrl: true });
  const { data, error } = await supabase
    .from("documents")
    .update({ title: parsed.data.title, category: parsed.data.category, external_url: parsed.data.externalUrl ?? null })
    .eq("organisation_id", access.ctx.org.id)
    .eq("id", doc.id)
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data.length) return failure("not_found");
  refresh();
  return { ok: true };
}

async function setArchived(formData: FormData, archived: boolean): Promise<ActionState> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const documentId = field(formData, "documentId");
  if (!z.uuid().safeParse(documentId).success) return failure("not_found");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("organisation_id", access.ctx.org.id)
    .eq("id", documentId)
    .eq("status", "ready")
    .select("id");
  if (error) return failure(dbErrorCode(error));
  if (!data.length) return failure("not_found");
  refresh();
  return { ok: true };
}

export async function archiveDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return setArchived(formData, true);
}

export async function restoreDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return setArchived(formData, false);
}

const deleteFileSchema = z.object({
  documentId: z.uuid(),
  // The page to come back to; only pages of this company.
  back: z.string().regex(/^\/o\/[a-z0-9-]+(\/[a-z0-9-]+)+$/),
});

/**
 * Deletes a file uploaded before links (docs/DATABASE.md §5k): the database marks it deleted
 * (authorised there: operators for attachments, admins for general documents), the file is
 * removed from Storage with the user's own session, and the database confirms the object is
 * gone. The row stays as a trace. A failed removal is reported and can be finished from the
 * same button; the file is unreadable from the first step on.
 */
export async function deleteDocumentFile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "operator");
  if (!access.ok) return access.error;
  const parsed = deleteFileSchema.safeParse({ documentId: field(formData, "documentId"), back: field(formData, "back") });
  if (!parsed.success || !parsed.data.back.startsWith(`/o/${access.ctx.org.slug}/`)) return failure("not_found");
  const { documentId, back } = parsed.data;
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("id")
    .eq("organisation_id", access.ctx.org.id)
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return failure("not_found");

  const { data: path, error } = await supabase.rpc("delete_document_file", { p_document_id: doc.id });
  if (error || !path) return failure(dbErrorCode(error));
  const { error: removeError } = await supabase.storage.from("documents").remove([path]);
  if (removeError) return failure("file_delete_incomplete");
  const { data: removed, error: confirmError } = await supabase.rpc("confirm_document_file_removed", {
    p_document_id: doc.id,
  });
  if (confirmError || !removed) return failure("file_delete_incomplete");
  redirect(`${back}?kustutatud=1`);
}
