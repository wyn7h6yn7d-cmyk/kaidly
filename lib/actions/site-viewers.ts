"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { dbErrorCode } from "@/lib/db/errors";
import { createClient } from "@/lib/supabase/server";
import { field } from "@/lib/validation/common";
import { inviteTokenSchema } from "@/lib/validation/organisations";
import { actionContext } from "./context";
import { type ActionState, failure } from "./state";

// Objekti vaataja: owners/admins invite and revoke; the database checks the role, the
// company and the sites again (create_site_viewer_invitation, revoke_site_viewer).

const uuid = z.string().uuid();
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  siteIds: z.array(uuid).min(1).max(50),
});

export async function createSiteViewerInvitation(
  _prev: ActionState<{ token: string; expiresAt: string; email: string }>,
  formData: FormData,
): Promise<ActionState<{ token: string; expiresAt: string; email: string }>> {
  const auth = await actionContext(formData, "admin");
  if (!auth.ok) return auth.error;
  const parsed = inviteSchema.safeParse({
    email: field(formData, "email"),
    siteIds: formData.getAll("siteIds").map(String),
  });
  if (!parsed.success) {
    const sites = parsed.error.issues.some((i) => i.path[0] === "siteIds");
    return failure(sites ? "invalid_sites" : "invalid_email", sites ? { siteIds: true } : { email: true });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_site_viewer_invitation", {
      p_organisation_id: auth.ctx.org.id,
      p_email: parsed.data.email,
      p_site_ids: parsed.data.siteIds,
    })
    .single();
  if (error || !data) return failure(dbErrorCode(error));
  refresh();
  // The plaintext token goes to the inviting admin exactly once and is never stored.
  return { ok: true, data: { token: data.token, expiresAt: data.expires_at, email: parsed.data.email } };
}

export async function revokeSiteViewer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await actionContext(formData, "admin");
  if (!auth.ok) return auth.error;
  const parsed = uuid.safeParse(field(formData, "viewerId"));
  if (!parsed.success) return failure("invalid_input");
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_site_viewer", { p_viewer_id: parsed.data });
  if (error) return failure(dbErrorCode(error));
  refresh();
  return { ok: true };
}

export async function revokeSiteViewerInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await actionContext(formData, "admin");
  if (!auth.ok) return auth.error;
  const parsed = uuid.safeParse(field(formData, "invitationId"));
  if (!parsed.success) return failure("invalid_input");
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_site_viewer_invitation", { p_invitation_id: parsed.data });
  if (error) return failure(dbErrorCode(error));
  refresh();
  return { ok: true };
}

export async function acceptSiteViewerInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = inviteTokenSchema.safeParse(field(formData, "token"));
  if (!parsed.success) return failure("invitation_invalid");
  const supabase = await createClient();
  const { data: siteId, error } = await supabase.rpc("accept_site_viewer_invitation", { p_token: parsed.data });
  if (error || !siteId) return failure(dbErrorCode(error));
  redirect(`/vaade/${siteId}`);
}
