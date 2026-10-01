"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getOrgContext } from "@/lib/data/organisations";
import { dbErrorCode } from "@/lib/db/errors";
import { hasRole } from "@/lib/auth/roles";
import {
  checkFile,
  DOCUMENT_CATEGORIES,
  sanitizeFilename,
  titleFromFilename,
} from "@/lib/documents/rules";
import { createClient } from "@/lib/supabase/server";
import { field, requiredText } from "@/lib/validation/common";
import { actionContext } from "./context";
import { type ActionState, failure, invalidInput } from "./state";

// Upload flow (see docs/DATABASE.md §10): registerUpload → the browser uploads the bytes
// straight to Storage at the returned path → finalizeUpload. File bytes never pass
// through the app server. Organisation, site and installation always come from the
// database (RLS), never from the client.

const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("organisation") }),
  z.object({ kind: z.literal("site"), id: z.uuid() }),
  z.object({ kind: z.literal("installation"), id: z.uuid() }),
  z.object({ kind: z.literal("logEntry"), id: z.uuid() }),
  z.object({ kind: z.literal("deficiency"), id: z.uuid() }),
]);

export type UploadTarget = z.infer<typeof targetSchema>;

const registerSchema = z.object({
  orgSlug: z.string().max(60),
  target: targetSchema,
  file: z.object({ name: z.string().min(1).max(1000), type: z.string().max(200), size: z.number().int() }),
  title: z.string().trim().max(200).optional(),
  category: z.enum(DOCUMENT_CATEGORIES),
});

export type RegisterUploadInput = z.input<typeof registerSchema>;
export type RegisteredUpload = { id: string; path: string };

type Placement = {
  site_id: string | null;
  electrical_installation_id: string | null;
  log_entry_id: string | null;
  deficiency_id: string | null;
};

async function placementFor(organisationId: string, target: UploadTarget): Promise<Placement | null> {
  const none = { site_id: null, electrical_installation_id: null, log_entry_id: null, deficiency_id: null };
  if (target.kind === "organisation") return none;
  const supabase = await createClient();
  switch (target.kind) {
    case "site": {
      const { data } = await supabase
        .from("sites")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("id", target.id)
        .maybeSingle();
      return data ? { ...none, site_id: data.id } : null;
    }
    case "installation": {
      const { data } = await supabase
        .from("electrical_installations")
        .select("id, site_id")
        .eq("organisation_id", organisationId)
        .eq("id", target.id)
        .maybeSingle();
      return data ? { ...none, site_id: data.site_id, electrical_installation_id: data.id } : null;
    }
    case "logEntry": {
      const { data } = await supabase
        .from("log_entries")
        .select("id, site_id, electrical_installation_id")
        .eq("organisation_id", organisationId)
        .eq("id", target.id)
        .maybeSingle();
      return data
        ? { ...none, site_id: data.site_id, electrical_installation_id: data.electrical_installation_id, log_entry_id: data.id }
        : null;
    }
    case "deficiency": {
      const { data } = await supabase
        .from("deficiencies")
        .select("id, site_id, electrical_installation_id")
        .eq("organisation_id", organisationId)
        .eq("id", target.id)
        .maybeSingle();
      return data
        ? { ...none, site_id: data.site_id, electrical_installation_id: data.electrical_installation_id, deficiency_id: data.id }
        : null;
    }
  }
}

/** Registers a pending document and returns the generated object path to upload to. */
export async function registerUpload(input: RegisterUploadInput): Promise<ActionState<RegisteredUpload>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return failure("invalid_input");
  const { orgSlug, target, file, title, category } = parsed.data;
  if (checkFile(file)) return failure("invalid_input");

  const ctx = await getOrgContext(orgSlug);
  if (!ctx) return failure("not_found");
  if (!hasRole(ctx.role, "operator")) return failure("forbidden");
  const placement = await placementFor(ctx.org.id, target);
  if (!placement) return failure("not_found");

  const filename = sanitizeFilename(file.name);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      organisation_id: ctx.org.id,
      ...placement,
      category,
      title: title || titleFromFilename(filename),
      original_filename: filename,
      mime_type: file.type.toLowerCase(),
      size_bytes: file.size,
    })
    .select("id, storage_path")
    .single();
  if (error || !data) return failure(dbErrorCode(error));
  return { ok: true, data: { id: data.id, path: data.storage_path } };
}

/** Checks the uploaded object and marks the document ready (or failed). */
export async function finalizeUpload(orgSlug: string, documentId: string): Promise<ActionState> {
  const ctx = await getOrgContext(orgSlug);
  if (!ctx || !z.uuid().safeParse(documentId).success) return failure("not_found");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finalize_document", { p_document_id: documentId });
  if (error) return failure(dbErrorCode(error));
  return data === "ready" ? { ok: true } : failure("unknown");
}

/**
 * Removes the caller's own incomplete upload (object and row) after a failure. Ready
 * documents are never removed — the database refuses it.
 */
export async function discardUpload(orgSlug: string, documentId: string): Promise<ActionState> {
  const ctx = await getOrgContext(orgSlug);
  if (!ctx || !z.uuid().safeParse(documentId).success) return failure("not_found");
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("organisation_id", ctx.org.id)
    .eq("id", documentId)
    .eq("uploaded_by", ctx.user.id)
    .neq("status", "ready")
    .maybeSingle();
  if (!doc) return failure("not_found");
  // Remove the object first; if that fails, keep the row so the leftover stays visible in
  // the storage report instead of becoming an object nobody can trace.
  const { error: removeError } = await supabase.storage.from("documents").remove([doc.storage_path]);
  if (removeError) return failure("unknown");
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) return failure(dbErrorCode(error));
  return { ok: true };
}

const updateSchema = z.object({
  documentId: z.uuid(),
  title: requiredText(200),
  category: z.enum(DOCUMENT_CATEGORIES),
});

export async function updateDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const parsed = updateSchema.safeParse({
    documentId: field(formData, "documentId"),
    title: field(formData, "title"),
    category: field(formData, "category"),
  });
  if (!parsed.success) return invalidInput(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .update({ title: parsed.data.title, category: parsed.data.category })
    .eq("organisation_id", access.ctx.org.id)
    .eq("id", parsed.data.documentId)
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
