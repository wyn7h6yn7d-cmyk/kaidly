import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { EmptyState, LoadingBlock } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { listMyOrganisations } from "@/lib/data/organisations";
import { t } from "@/lib/i18n";
import { LAST_ORG_COOKIE } from "@/lib/org-cookie";

export const metadata: Metadata = { title: t.app.organisations.title };

async function OrganisationList({
  searchParams,
}: {
  searchParams: Promise<{ vali?: string }>;
}) {
  const [{ vali }, organisations, cookieStore] = await Promise.all([
    searchParams,
    listMyOrganisations(),
    cookies(),
  ]);

  // Go straight to the last used (or only) organisation unless the user asked to choose.
  if (vali === undefined) {
    const last = cookieStore.get(LAST_ORG_COOKIE)?.value;
    const target =
      organisations.find((org) => org.slug === last) ??
      (organisations.length === 1 ? organisations[0] : undefined);
    if (target) redirect(`/o/${target.slug}`);
  }

  if (organisations.length === 0) {
    return (
      <EmptyState
        title={t.app.organisations.emptyTitle}
        body={t.app.organisations.emptyBody}
        action={
          <Button asChild>
            <Link href="/o/uus">
              <Plus aria-hidden="true" />
              {t.app.organisations.create}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
      {organisations.map((org) => (
        <li key={org.id}>
          <Link
            href={`/o/${org.slug}`}
            className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-k-paper-2 sm:px-5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{org.name}</span>
              <span className="mt-1 block text-sm text-k-muted">
                {t.app.organisations.yourRole}: {t.roles[org.role]}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-k-grey" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function OrganisationsPage({
  searchParams,
}: {
  searchParams: Promise<{ vali?: string }>;
}) {
  return (
    <PlainPage>
      <PageHeader
        title={t.app.organisations.choose}
        actions={
          <Button asChild variant="outline">
            <Link href="/o/uus">
              <Plus aria-hidden="true" />
              {t.app.organisations.create}
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<LoadingBlock />}>
        <OrganisationList searchParams={searchParams} />
      </Suspense>
    </PlainPage>
  );
}
