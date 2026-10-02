import type { NotificationItem } from "@/lib/data/notifications";
import type { T } from "@/lib/i18n";
import { countdown, countdownText, type CountdownLevel } from "@/lib/schedule";

/**
 * What a reminder says now. The countdown is derived at display time from the reminder's
 * due occurrence; a reminder whose occurrence has passed (completed, rescheduled,
 * archived) is history and shows no countdown.
 */
export function describeNotification(item: NotificationItem, t: T, today: string) {
  const current = !item.archived && item.next_due_on === item.due_on;
  const value = current ? countdown(item.due_on, today) : null;
  return {
    current,
    level: (value?.level ?? null) as CountdownLevel | null,
    countdown: value ? countdownText(value, t.countdown) : null,
    where: [item.site, [item.identifier, item.installation].filter(Boolean).join(" ")].join(" · "),
    due: t.notifications.due(t.fmt.date(item.due_on)),
    note: item.archived ? t.notifications.archived : current ? null : t.notifications.historical,
  };
}
