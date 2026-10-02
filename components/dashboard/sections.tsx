import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

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

export type OnboardingStep = {
  key: string;
  title: string;
  body: string;
  done: boolean;
  cta?: { href: string; label: string };
};

/** First-use checklist: what is done, and one clear next action. No tours. */
export async function Onboarding({ steps }: { steps: OnboardingStep[] }) {
  const t = await getT();
  const copy = t.app.onboarding;
  const next = steps.findIndex((step) => !step.done);
  return (
    <section aria-labelledby="onboarding" className="mb-10 border border-k-line bg-k-surface px-4 py-5 sm:px-6">
      <h2 id="onboarding" className="text-xl font-bold">
        {copy.title}
      </h2>
      <p className="mt-1 text-k-muted">{copy.intro}</p>
      <ol className="mt-5 grid grid-cols-1 gap-4">
        {steps.map((step, index) => {
          const current = index === next;
          return (
            <li key={step.key} className="flex gap-4" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center border text-sm font-bold",
                  step.done ? "border-k-green bg-k-green text-white" : current ? "border-k-ink" : "border-k-line text-k-muted",
                )}
                aria-hidden="true"
              >
                {step.done ? <Check className="size-4" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className={cn("font-semibold", !step.done && !current && "text-k-muted")}>
                  <span className="sr-only">{copy.stepLabel(index + 1)}: </span>
                  {step.title}
                  {step.done && <span className="ml-2 text-sm font-medium text-k-green">{copy.done}</span>}
                </p>
                {!step.done && <p className="text-sm text-k-muted">{step.body}</p>}
                {current && step.cta && (
                  <Button asChild size="lg" className="mt-3">
                    <Link href={step.cta.href}>{step.cta.label}</Link>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
