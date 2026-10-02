import { notificationSummary } from "@/lib/data/notifications";
import { getT } from "@/lib/i18n/server";
import { daysBetween } from "@/lib/schedule";
import { todayInTallinn } from "@/lib/time";
import { describeNotification } from "./describe";
import { ReminderToast } from "./reminder-toast";

/** Feeds the newest unread, current reminder from the last week to the toast. */
export async function ReminderToastSlot() {
  const [t, { latest }] = await Promise.all([getT(), notificationSummary()]);
  const today = todayInTallinn();
  let reminder = null;
  if (latest && daysBetween(todayInTallinn(new Date(latest.created_at)), today) <= 7) {
    const d = describeNotification(latest, t, today);
    if (d.current && d.countdown && d.level) {
      reminder = { id: latest.id, title: latest.title, where: d.where, countdown: d.countdown, level: d.level };
    }
  }
  return <ReminderToast reminder={reminder} />;
}
