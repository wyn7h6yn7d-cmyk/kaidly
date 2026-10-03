import { Bell } from "lucide-react";
import { CountdownMark } from "@/components/schedule/countdown-mark";
import { getT } from "@/lib/i18n/server";
import { addDays } from "@/lib/schedule";
import { todayInTallinn } from "@/lib/time";

/**
 * Static product mock-up of two KAIDLY in-app notifications (HTML, no images), styled like
 * the real notification centre and using the real countdown wording. Not interactive.
 */
export async function ReminderExample() {
  const t = await getT();
  const r = t.landing.reminders;
  const due = addDays(todayInTallinn(), 14);
  return (
    <figure role="img" aria-label={r.exampleLabel} className="min-w-0">
      <div className="border border-k-line bg-k-surface shadow-[0_2px_16px_rgba(17,24,39,0.06)]">
        <div className="flex items-center gap-2 border-b border-k-line px-5 py-3.5 text-[15px] font-semibold sm:px-6">
          <Bell className="size-4 text-k-green" aria-hidden="true" />
          {t.notifications.title}
          <span className="ml-auto rounded-full bg-k-danger px-2 text-xs font-bold leading-5 text-white">1</span>
        </div>
        <div className="border-b border-l-4 border-b-k-line border-l-k-green px-5 py-5 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-wider text-k-green">{t.notifications.unread}</p>
          <p className="mt-1.5 text-lg font-bold sm:text-xl">{r.exampleTitle}</p>
          <p className="mt-0.5 text-[15px] text-k-muted">{r.exampleWhere}</p>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px]">
            <span className="tabular-nums">{t.notifications.due(t.fmt.date(due))}</span>
            <CountdownMark level="warning" text={t.countdown.left(14)} />
          </p>
          <span className="mt-4 inline-flex min-h-11 items-center rounded-sm border border-k-ink/80 px-4 text-[15px] font-semibold">
            {r.exampleCta} →
          </span>
        </div>
        <div className="px-5 py-5 opacity-80 sm:px-6">
          <p className="font-semibold">{r.exampleOverdueTitle}</p>
          <p className="mt-0.5 text-[15px] text-k-muted">{r.exampleOverdueWhere}</p>
          <p className="mt-2">
            <CountdownMark level="overdue" text={t.countdown.overdue(3)} />
          </p>
        </div>
      </div>
      <figcaption className="mt-4 flex items-center gap-2 text-[15px] text-k-muted">
        <Bell className="size-4" aria-hidden="true" />
        {r.note}
      </figcaption>
    </figure>
  );
}
