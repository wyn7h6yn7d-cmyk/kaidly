import { Clock, Lock } from "lucide-react";
import { contactMailto } from "@/lib/access";
import type { OrgContext } from "@/lib/data/organisations";
import { getT } from "@/lib/i18n/server";
import { daysBetween } from "@/lib/schedule";
import { todayInTallinn } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Whole Tallinn calendar days until the access end (expiry itself is the exact timestamp). */
export function daysLeft(endsAt: string) {
  return daysBetween(todayInTallinn(), todayInTallinn(new Date(endsAt)));
}

export async function ContinueLink({ ctx, className }: { ctx: OrgContext; className?: string }) {
  const t = await getT();
  // Server setting (not a secret); without it the banner only says to contact KAIDLY.
  const href = contactMailto(process.env.KAIDLY_CONTACT_EMAIL, t.access.mailSubject(ctx.org.name));
  if (!href) return <p className={cn("text-sm", className)}>{t.access.contactHint}</p>;
  return (
    <a href={href} className={cn("inline-flex min-h-11 items-center font-semibold text-k-green underline underline-offset-4", className)}>
      {t.access.continue}
    </a>
  );
}

/**
 * Company access status above every page of the company: a quiet line during the trial,
 * more visible in its last 3 days, and a persistent read-only notice once it has ended.
 * Nothing for active full access.
 */
export async function AccessBanner({ ctx }: { ctx: OrgContext }) {
  const t = await getT();
  const { access } = ctx;
  if (ctx.org.deactivatedAt || access.status === "active") return null;

  if (access.status === "expired") {
    return (
      <section
        aria-labelledby="access-expired"
        data-testid="access-banner"
        className="mb-6 border-l-4 border-k-warn bg-k-surface px-4 py-4 sm:px-5"
      >
        <h2 id="access-expired" className="flex items-center gap-2 font-bold">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          {access.hadFullAccess ? t.access.expiredAccess : t.access.expiredTrial}
        </h2>
        <p className="mt-1 text-sm text-k-ink/85">{t.access.expiredBody}</p>
        <ContinueLink ctx={ctx} className="mt-1" />
      </section>
    );
  }

  if (!access.endsAt) return null;
  const days = daysLeft(access.endsAt);
  const urgent = days <= 3;
  // A quiet status panel during the trial; a warn edge only in the last three days.
  // Not a live region: it is page context, not an event to announce.
  return (
    <section
      aria-label={t.access.trial(days)}
      data-testid="access-banner"
      className={cn(
        "mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border bg-k-surface px-4 py-3 text-sm",
        urgent ? "border-k-line border-l-4 border-l-k-warn" : "border-k-line",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", urgent ? "bg-k-warn/10 text-k-warn" : "bg-k-paper-2 text-k-muted")}
      >
        <Clock className="size-4" />
      </span>
      <span className="font-semibold text-k-ink">{t.access.trial(days)}</span>
      <span className="text-k-muted">{t.access.trialUntil(t.fmt.dateTime(access.endsAt))}</span>
      {urgent && <ContinueLink ctx={ctx} className="sm:ml-auto" />}
    </section>
  );
}
