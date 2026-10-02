import Link from "next/link";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { CountdownMark } from "@/components/schedule/countdown-mark";
import { markNotificationRead } from "@/lib/actions/notifications";
import type { NotificationItem } from "@/lib/data/notifications";
import { getT } from "@/lib/i18n/server";
import { todayInTallinn } from "@/lib/time";
import { cn } from "@/lib/utils";
import { describeNotification } from "./describe";

/** Newest first; unread rows carry a visible mark and a text label for screen readers. */
export async function NotificationList({ items }: { items: NotificationItem[] }) {
  const t = await getT();
  const today = todayInTallinn();
  const copy = t.notifications;
  return (
    <ol aria-label={copy.title} className="divide-y divide-k-line border border-k-line bg-k-surface">
      {items.map((item) => {
        const d = describeNotification(item, t, today);
        const unread = item.read_at === null;
        return (
          <li
            key={item.id}
            data-unread={unread || undefined}
            className={cn("flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-6 sm:px-5", unread && "border-l-4 border-l-k-green")}
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                {unread && <span className="text-xs font-bold uppercase tracking-wider text-k-green">{copy.unread}</span>}
                <span className={cn("break-words", unread ? "font-bold" : "font-semibold")}>{item.title}</span>
              </p>
              <p className="break-words text-sm text-k-muted">
                {item.company} · {d.where}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="tabular-nums">{d.due}</span>
                {d.countdown && d.level && <CountdownMark level={d.level} text={d.countdown} />}
              </p>
              {d.note && <p className="mt-1 text-sm text-k-muted">{d.note}</p>}
              <p className="mt-1 text-xs text-k-muted">
                {copy.reminder(item.threshold_days)} · {t.fmt.dateTime(item.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/teavitused/${item.id}`}
                prefetch={false}
                className="inline-flex min-h-11 items-center rounded-sm border border-k-ink/80 px-4 text-sm font-semibold hover:bg-k-ink/5"
              >
                {copy.view}
              </Link>
              {unread && (
                <ConfirmForm
                  action={markNotificationRead}
                  fields={{ notificationId: item.id }}
                  label={copy.markRead}
                  variant="ghost"
                />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
