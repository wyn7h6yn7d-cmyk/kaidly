import Link from "next/link";
import { Suspense } from "react";
import { AdminTitle, Stat } from "@/components/admin/ui";
import { LoadingBlock } from "@/components/app/states";
import { fmtBytes, fmtNumber } from "@/lib/admin/format";
import { ADMIN } from "@/lib/admin/strings";
import { adminAccessOverview, adminOverview } from "@/lib/data/admin";

async function Overview() {
  const [o, access] = await Promise.all([adminOverview(), adminAccessOverview()]);
  const s = ADMIN.overview;
  const a = ADMIN.access.overview;
  return (
    <>
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-x-6 gap-y-5">
        <Stat label={s.users} value={fmtNumber(o.users)} />
        <Stat label={s.usersActive} value={fmtNumber(o.users_active_30d)} />
        <Stat label={s.companies} value={fmtNumber(o.companies)} />
        <Stat label={s.companiesActive} value={fmtNumber(o.companies_active)} />
        <Stat label={s.companiesDeactivated} value={fmtNumber(o.companies_deactivated)} />
        <Stat label={s.sites} value={fmtNumber(o.sites)} />
        <Stat label={s.installations} value={fmtNumber(o.installations)} />
        <Stat label={s.entries30d} value={fmtNumber(o.log_entries_30d)} />
        <Stat label={s.overdue} value={fmtNumber(o.activities_overdue)} tone={o.activities_overdue ? "danger" : undefined} />
        <Stat label={s.dueSoon} value={fmtNumber(o.activities_due_soon)} tone={o.activities_due_soon ? "warn" : undefined} />
        <Stat label={s.deficienciesOpen} value={fmtNumber(o.deficiencies_open)} />
        <Stat
          label={s.deficienciesSerious}
          value={fmtNumber(o.deficiencies_serious)}
          tone={o.deficiencies_serious ? "danger" : undefined}
        />
        <Stat label={s.documents} value={fmtNumber(o.documents)} />
        <Stat label={s.storage} value={fmtBytes(o.storage_bytes)} />
      </dl>
      <h2 className="mb-3 mt-10 text-lg font-bold">{ADMIN.access.title}</h2>
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-x-6 gap-y-5">
        <Stat label={a.trials} value={fmtNumber(access.trials)} />
        <Stat label={a.ending} value={fmtNumber(access.trials_ending_7d)} tone={access.trials_ending_7d ? "warn" : undefined} />
        <Stat label={a.expiredTrials} value={fmtNumber(access.expired_trials)} />
        <Stat label={a.active} value={fmtNumber(access.active)} />
        <Stat label={a.expired} value={fmtNumber(access.expired)} />
        <Stat label={a.expired90} value={fmtNumber(access.expired_90)} tone={access.expired_90 ? "warn" : undefined} />
      </dl>
      <p className="mt-6 text-sm text-k-muted">
        {s.activeOnly}{" "}
        <Link href="/admin/deadlines" className="font-semibold text-k-green underline underline-offset-4">
          {ADMIN.nav.deadlines}
        </Link>
      </p>
    </>
  );
}

export default function AdminOverviewPage() {
  return (
    <>
      <AdminTitle title={ADMIN.overview.title} />
      <Suspense fallback={<LoadingBlock lines={4} />}>
        <Overview />
      </Suspense>
    </>
  );
}
