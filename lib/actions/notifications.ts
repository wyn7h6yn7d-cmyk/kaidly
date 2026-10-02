"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/sites";
import { type ActionState, failure } from "./state";

// RLS limits both to the caller's own notifications; only read_at is writable.

export async function markNotificationRead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = formData.get("notificationId");
  if (typeof id !== "string" || !isUuid(id)) return failure("not_found");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return failure("unknown");
  if (!data?.length) return failure("not_found");
  refresh();
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return failure("unknown");
  refresh();
  return { ok: true };
}
