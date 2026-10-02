import Link from "next/link";
import { Check } from "lucide-react";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { Button } from "@/components/ui/button";
import { hideGuide } from "@/lib/actions/onboarding";
import type { OnboardingStep } from "@/lib/onboarding";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/** A titled list on the dashboard: first rows, the total, and a link to the full list. */
export async function AttentionSection({
  id,
  title,
  total,
  allHref,
  empty,
  allLabel,
  children,
}: {
  id: string;
  title: string;
  total: number;
  allHref: string;
  empty: string;
  /** For lists without a meaningful total (e.g. the latest entries). */
  allLabel?: string;
  children: React.ReactNode;
}) {
  const t = await getT();
  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-4 border-b-2 border-k-ink pb-2">
        <h3 id={id} className="font-bold">
          {title}
        </h3>
        {!allLabel && (
          <span className="text-sm font-semibold tabular-nums text-k-muted" aria-hidden="true">
            {total}
          </span>
        )}
      </div>
      {total === 0 ? (
        <p className="py-3 text-sm text-k-muted">{empty}</p>
      ) : (
        <>
          <ul aria-label={title} className="divide-y divide-k-line">
            {children}
          </ul>
          <p className="mt-1">
            <Link
              href={allHref}
              className="inline-flex h-11 items-center text-sm font-semibold text-k-green underline underline-offset-4"
            >
              {allLabel ?? t.app.dashboard.showAll(total)}
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

/** One dashboard row: linked title, context line, and a right-aligned mark. */
export function AttentionRow({
  href,
  title,
  context,
  mark,
}: {
  href: string;
  title: string;
  context?: string | null;
  mark?: React.ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <Link href={href} className="line-clamp-2 break-words font-semibold underline-offset-4 hover:underline">
          {title}
        </Link>
        {context && <p className="truncate text-sm text-k-muted">{context}</p>}
      </div>
      {mark && <div className="flex shrink-0 flex-wrap items-center gap-2">{mark}</div>}
    </li>
  );
}

/**
 * Getting-started checklist: one compact vertical list, real progress, one action per
 * open step (or the reason it can't be done yet). No tours, no modals.
 */
export async function OnboardingChecklist({
  orgSlug,
  steps,
  hideable = false,
  headingLevel = 2,
}: {
  orgSlug: string;
  steps: OnboardingStep[];
  hideable?: boolean;
  headingLevel?: 2 | 3;
}) {
  const t = await getT();
  const copy = t.app.onboarding;
  const done = steps.filter((step) => step.done).length;
  const next = steps.findIndex((step) => !step.done);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby="onboarding" className="border border-k-line bg-k-surface px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Heading id="onboarding" className="text-xl font-bold">
          {copy.title}
        </Heading>
        <p className="text-sm font-semibold tabular-nums text-k-ink">{copy.progress(done, steps.length)}</p>
      </div>
      {/* Same source of truth as the count: the real onboarding state. */}
      <div
        role="progressbar"
        aria-label={copy.title}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        aria-valuetext={copy.progress(done, steps.length)}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-k-paper-2"
      >
        <div className="h-full rounded-full bg-k-green" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} />
      </div>
      <p className="mt-3 text-k-ink/75">{done === steps.length ? copy.complete : copy.intro}</p>
      <ol className="mt-6 grid grid-cols-1 gap-5">
        {steps.map((step, index) => {
          const text = copy.steps[step.key];
          const current = index === next;
          const reason = step.blockedBy
            ? {
                site: copy.needsSite,
                installation: copy.needsInstallation,
                role: copy.needsRole,
                trial_ended: copy.needsTrial,
                access_ended: copy.needsAccess,
              }[step.blockedBy]
            : null;
          return (
            <li key={step.key} className="flex gap-4" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border text-[15px] font-bold tabular-nums",
                  step.done
                    ? "border-k-green bg-k-green text-white"
                    : current
                      ? "border-2 border-k-ink text-k-ink"
                      : "border-k-line text-k-muted",
                )}
                aria-hidden="true"
              >
                {step.done ? <Check className="size-4" /> : index + 1}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <p className={cn("text-[17px] font-semibold leading-snug", step.done ? "text-k-ink/70" : !current && "text-k-ink/80")}>
                  <span className="sr-only">{copy.stepLabel(index + 1)}: </span>
                  {text.title}
                  {step.done && <span className="ml-2 text-sm font-medium text-k-green">{copy.done}</span>}
                </p>
                {!step.done && <p className="mt-0.5 text-[15px] text-k-ink/70">{text.body}</p>}
                {!step.done && reason && (
                  <p className="mt-2 inline-block rounded-sm bg-k-paper-2 px-2.5 py-1 text-sm text-k-ink/80">{reason}</p>
                )}
                {step.href && (
                  <Button asChild size={current ? "lg" : "sm"} variant={current ? "default" : "outline"} className="mt-3">
                    <Link href={step.href}>{"cta" in text ? text.cta : text.title}</Link>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-5 text-sm text-k-muted">{copy.optionalNote}</p>
      {hideable && (
        <div className="mt-3">
          <ConfirmForm action={hideGuide} fields={{ orgSlug }} label={copy.hide} variant="ghost" />
        </div>
      )}
    </section>
  );
}
