import Link from "next/link";
import { Lock } from "lucide-react";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { Button } from "@/components/ui/button";
import { reactivateOrganisation } from "@/lib/actions/organisation-lifecycle";
import type { OrgContext } from "@/lib/data/organisations";
import { getT } from "@/lib/i18n/server";


/** One sentence on what to do next and the button to do it. No illustrations. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="border border-dashed border-k-grey/50 bg-k-paper-2 px-5 py-8 sm:px-8">
      <h2 className="text-lg font-bold">{title}</h2>
      {body && <p className="mt-1 max-w-xl text-k-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}

export async function ForbiddenState({ orgSlug }: { orgSlug: string }) {
  const t = await getT();
  return (
    <section className="max-w-xl border border-k-line bg-k-surface p-6">
      <Lock className="mb-3 size-5 text-k-muted" aria-hidden="true" />
      <h1 className="text-2xl font-extrabold">{t.app.forbidden.title}</h1>
      <p className="mt-2 text-k-muted">{t.app.forbidden.body}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href={`/o/${orgSlug}`}>{t.app.forbidden.backToOverview}</Link>
      </Button>
    </section>
  );
}

/** A clear "this can't be done any more" notice with a way back — not a permission error. */
export function NoticeState({
  message,
  href,
  linkLabel,
}: {
  message: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <section className="max-w-xl border-l-4 border-k-grey bg-k-surface p-5">
      <p>{message}</p>
      <Button asChild variant="outline" className="mt-4">
        <Link href={href}>{linkLabel}</Link>
      </Button>
    </section>
  );
}

export async function LoadingBlock({ lines = 3 }: { lines?: number }) {
  const t = await getT();
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse space-y-3">
      <span className="sr-only">{t.common.loading}</span>
      <div className="h-8 w-2/3 max-w-sm bg-k-line/70" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-14 bg-k-line/50" />
      ))}
    </div>
  );
}

/** Loading frame that matches AppShell, so the sidebar and bars don't pop in later. */
export function ShellSkeleton() {
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[264px_1fr]">
      <div className="hidden bg-k-green lg:block lg:h-svh" />
      <div className="flex min-h-svh flex-col">
        <div className="h-14 border-b border-k-line bg-k-paper lg:hidden" />
        <div className="k-app-container flex-1 pt-6 lg:pt-10">
          <LoadingBlock />
        </div>
        <div className="fixed inset-x-0 bottom-0 h-16 border-t border-k-line bg-k-surface lg:hidden" />
      </div>
    </div>
  );
}

/** Every page of a deactivated organisation: what happened, data kept, owners can restore. */
export async function DeactivatedState({ ctx }: { ctx: OrgContext }) {
  const t = await getT();
  const l = t.app.lifecycle;
  return (
    <section className="max-w-xl border border-k-line bg-k-surface p-6">
      <Lock className="mb-3 size-5 text-k-muted" aria-hidden="true" />
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-k-muted">{ctx.org.name}</p>
      <h1 className="mt-1 text-2xl font-extrabold">{l.deactivatedTitle}</h1>
      <p className="mt-2 text-k-muted">{l.deactivatedBody}</p>
      {ctx.org.deactivatedAt && <p className="mt-1 text-sm text-k-muted">{l.deactivatedOn(t.fmt.date(ctx.org.deactivatedAt))}</p>}
      <div className="mt-6 grid gap-3">
        {ctx.role === "owner" ? (
          <>
            <p className="text-sm">{l.ownerCanRestore}</p>
            <ConfirmForm
              action={reactivateOrganisation}
              fields={{ organisationId: ctx.org.id, orgSlug: ctx.org.slug }}
              label={l.reactivate}
              variant="default"
              size="default"
            />
          </>
        ) : (
          <p className="text-sm">{l.askOwner}</p>
        )}
        <Button asChild variant="outline" className="justify-self-start">
          <Link href="/o?vali=1">{t.app.notFound.toOrganisations}</Link>
        </Button>
      </div>
    </section>
  );
}
