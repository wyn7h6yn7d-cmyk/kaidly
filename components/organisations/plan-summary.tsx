import Link from "next/link";
import { contactMailto } from "@/lib/access";
import { getOrgPlan, type OrgPlan } from "@/lib/data/plan";
import { getT } from "@/lib/i18n/server";
import { PLAN_DETAILS } from "@/lib/plans";

type T = Awaited<ReturnType<typeof getT>>;

export function planName(t: T, p: OrgPlan): string {
  if (p.plan === "custom") return p.planLabel ?? t.app.plan.none;
  if (p.plan) return PLAN_DETAILS[p.plan].name;
  return t.app.plan.none;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-k-line py-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-semibold text-k-muted">{label}</dt>
      <dd className="break-words tabular-nums">{value}</dd>
    </div>
  );
}

/** "How to change it": pricing on kaidly.ee and the KAIDLY contact address (server setting). */
export async function PlanLinks({ orgName }: { orgName: string }) {
  const t = await getT();
  const contact = contactMailto(process.env.KAIDLY_CONTACT_EMAIL, t.app.plan.contactSubject(orgName));
  return (
    <p className="flex flex-wrap gap-x-6 gap-y-1">
      <Link href="/#hinnad" className="inline-flex min-h-11 items-center font-semibold text-k-green underline underline-offset-4">
        {t.app.plan.pricing}
      </Link>
      {contact && (
        <a href={contact} className="inline-flex min-h-11 items-center font-semibold text-k-green underline underline-offset-4">
          {t.app.plan.contact}
        </a>
      )}
    </p>
  );
}

/** The company's plan, usage and validity for its members (read-only; KAIDLY changes it). */
export async function PlanSummary({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [t, p] = await Promise.all([getT(), getOrgPlan(orgId)]);
  const c = t.app.plan;
  const until =
    p.status === "active"
      ? [c.validUntil, p.indefinite || !p.paidUntil ? c.indefinite : t.fmt.date(p.paidUntil)]
      : p.status === "trial" && p.trialEndsAt
        ? [c.trialUntil, t.fmt.date(p.trialEndsAt)]
        : p.paidUntil
          ? [c.validUntil, t.fmt.date(p.paidUntil)]
          : null;
  return (
    <div>
      <dl className="max-w-2xl border-t border-k-line">
        <Row label={c.name} value={planName(t, p)} />
        <Row label={c.status} value={c.statuses[p.status]} />
        <Row label={c.users} value={c.usage(p.seatsUsed, p.userLimit)} />
        <Row label={c.installations} value={c.usage(p.installationsActive, p.installationLimit)} />
        {until && <Row label={until[0]} value={until[1]} />}
      </dl>
      <p className="mt-3 max-w-2xl text-sm text-k-muted">
        {c.seatsHint} {c.managedByKaidly}
      </p>
      <div className="mt-2">
        <PlanLinks orgName={orgName} />
      </div>
    </div>
  );
}

/** Shown instead of an action that would exceed the plan (the database refuses it anyway). */
export async function PlanLimitNotice({ kind, orgName }: { kind: "seats" | "installations"; orgName: string }) {
  const t = await getT();
  const c = t.app.plan;
  return (
    <div role="status" className="max-w-2xl border-l-4 border-k-warn bg-k-surface px-4 py-3">
      <p className="font-bold">{kind === "seats" ? c.seatsFull : c.installationsFull}</p>
      <p className="mt-1 text-sm text-k-muted">{kind === "seats" ? c.seatsFullBody : c.installationsFullBody}</p>
      <PlanLinks orgName={orgName} />
    </div>
  );
}
