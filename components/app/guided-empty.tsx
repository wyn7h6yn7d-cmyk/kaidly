import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Empty module that explains itself: what the area is for, examples or the short sequence
 * it follows, a missing prerequisite if there is one, and one primary action. Two columns
 * on desktop so the page is useful rather than blank; stacked on phones.
 */
export function GuidedEmptyState({
  title,
  body,
  examples,
  sequence,
  sequenceLabel,
  prerequisite,
  action,
  note,
}: {
  title: string;
  body: string;
  examples?: { label: string; items: readonly string[] };
  /** Ordered first steps (numbered) or a flow (arrows). */
  sequence?: { kind: "steps" | "flow"; items: readonly string[] };
  sequenceLabel?: string;
  /** Shown instead of the main action when something has to exist first. */
  prerequisite?: { text: string; action?: { href: string; label: string } };
  action?: { href: string; label: string };
  /** For people who can't act (e.g. viewers): who does it. */
  note?: string;
}) {
  const cta = prerequisite?.action ?? action;
  return (
    <section className="grid grid-cols-1 gap-8 border border-k-line bg-k-surface px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12 lg:py-10">
      <div className="min-w-0">
        <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-[17px] text-k-ink/80">{body}</p>
        {examples && (
          <p className="mt-4 text-sm text-k-muted">
            <span className="font-semibold text-k-ink">{examples.label}:</span> {examples.items.join(" · ")}
          </p>
        )}
        {prerequisite && <p className="mt-5 border-l-4 border-k-warn bg-k-paper-2 px-3 py-2">{prerequisite.text}</p>}
        {note && !cta && <p className="mt-5 text-k-muted">{note}</p>}
        {cta && (
          <Button asChild size="lg" className="mt-6">
            <Link href={cta.href}>
              {cta.label}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
      {sequence && (
        <div className="min-w-0 lg:border-l lg:border-k-line lg:pl-10">
          {sequenceLabel && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-k-muted">{sequenceLabel}</p>}
          <ol className="grid grid-cols-1 gap-3">
            {sequence.items.map((item, i) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center border border-k-ink/70 text-sm font-bold"
                >
                  {sequence.kind === "steps" ? i + 1 : i === 0 ? "•" : "→"}
                </span>
                <span className="pt-0.5">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
