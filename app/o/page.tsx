import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.app.organisations.title };

async function Greeting() {
  const user = await requireUser();
  return (
    <p className="mt-2 text-k-muted">
      {t.app.signedInAs} <span className="font-semibold text-k-ink">{user.fullName ?? user.email}</span>
    </p>
  );
}

// Placeholder until Phase 2 (organisation list, create, invitations).
export default function OrganisationsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-extrabold">{t.app.organisations.title}</h1>
      <Suspense fallback={<p className="mt-2 text-k-muted">{t.common.loading}</p>}>
        <Greeting />
      </Suspense>

      <section className="mt-10 border border-k-line bg-k-surface p-6">
        <h2 className="text-lg font-bold">{t.app.organisations.emptyTitle}</h2>
        <p className="mt-1 text-k-muted">{t.app.organisations.emptyBody}</p>
      </section>
    </div>
  );
}
