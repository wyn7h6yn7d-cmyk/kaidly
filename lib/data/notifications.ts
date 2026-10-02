import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// In-app notifications are per user. my_notifications() is a security INVOKER function,
// so the caller's RLS decides: own rows only, only while still a member, and the source
// activity, site and installation must be readable too.

export type NotificationItem = {
  id: string;
  created_at: string;
  read_at: string | null;
  due_on: string;
  threshold_days: number;
  activity_id: string;
  title: string;
  next_due_on: string | null;
  archived: boolean;
  company: string;
  slug: string;
  site: string;
  installation: string;
  identifier: string | null;
};

type Result = { unread: number; total: number; rows: NotificationItem[] };

export const NOTIFICATION_PAGE_SIZE = 20;

async function fetchNotifications(unreadOnly: boolean, limit: number, offset: number): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_notifications", {
    p_unread_only: unreadOnly,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return data as unknown as Result;
}

export function listNotifications(unreadOnly: boolean, page: number) {
  return fetchNotifications(unreadOnly, NOTIFICATION_PAGE_SIZE, page * NOTIFICATION_PAGE_SIZE);
}

/** Unread count and the newest unread reminder (bell and toast), once per request. */
export const notificationSummary = cache(async (): Promise<{ unread: number; latest: NotificationItem | null }> => {
  if (!(await getCurrentUser())) return { unread: 0, latest: null };
  const { unread, rows } = await fetchNotifications(true, 1, 0);
  return { unread, latest: rows[0] ?? null };
});

/** The application route of a notification's source — built from database ids, never stored. */
export function notificationSourcePath(item: Pick<NotificationItem, "slug" | "activity_id">) {
  return `/o/${item.slug}/kaidukava/${item.activity_id}`;
}
