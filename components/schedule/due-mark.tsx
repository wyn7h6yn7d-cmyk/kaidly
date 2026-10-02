import { countdown, countdownText } from "@/lib/schedule";
import { getT } from "@/lib/i18n/server";
import { CountdownMark } from "./countdown-mark";

/** Countdown to the next due date ("14 päeva jäänud", "Tähtaeg täna", "3 päeva üle tähtaja"). */
export async function DueMark({ nextDueOn, today }: { nextDueOn: string | null; today: string }) {
  const t = await getT();
  const value = countdown(nextDueOn, today);
  if (!value) return <CountdownMark level="done" text={t.app.schedule.states.done} />;
  return <CountdownMark level={value.level} text={countdownText(value, t.countdown)} />;
}

export async function DueDate({ nextDueOn }: { nextDueOn: string | null }) {
  const t = await getT();
  if (!nextDueOn) return <span className="text-k-muted">—</span>;
  return (
    <time dateTime={nextDueOn} className="font-semibold tabular-nums">
      {t.fmt.date(nextDueOn)}
    </time>
  );
}
