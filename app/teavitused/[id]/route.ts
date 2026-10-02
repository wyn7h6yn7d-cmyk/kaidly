import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/sites";

/**
 * "Vaata tegevust": marks the notification read and opens its source. The target is
 * built from database ids (organisation slug + activity id) — never a stored URL — and the
 * activity page checks access again, so nothing here can redirect elsewhere.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) redirect("/teavitused");
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, scheduled_activity_id, read_at, organisations(slug)")
    .eq("id", id)
    .maybeSingle();
  const slug = data?.organisations?.slug;
  if (!data || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !isUuid(data.scheduled_activity_id)) {
    redirect("/teavitused");
  }
  if (!data.read_at) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  }
  redirect(`/o/${slug}/kaidukava/${data.scheduled_activity_id}`);
}
