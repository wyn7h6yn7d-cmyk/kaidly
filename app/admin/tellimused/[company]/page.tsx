import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccessForms } from "@/components/admin/access-forms";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { SubscriptionForm } from "@/components/admin/subscription-form";
import { AdminTitle, Badge, Rows, Section, TableFrame, td, th } from "@/components/admin/ui";
import { LoadingBlock } from "@/components/app/states";
import { adminExpireAccess } from "@/lib/actions/admin";
import { fmtDate, fmtDateTime, fmtDayNumeric } from "@/lib/admin/format";
import { ADMIN } from "@/lib/admin/strings";
import { adminSubscription, type AdminSubscriptionSnapshot } from "@/lib/data/admin";
import { uuid } from "@/lib/validation/common";
import { planName, statusTone } from "@/components/admin/subscription-labels";

type Params = Promise<{ company: string }>;
const s = ADMIN.subs;

const snapPlan = (x: AdminSubscriptionSnapshot | null) => (x ? planName(x) : "—");
const snapUntil = (x: AdminSubscriptionSnapshot | null) => (x?.paid_until ? fmtDayNumeric(x.paid_until) : "—");
const snapLimits = (x: AdminSubscriptionSnapshot | null) =>
  x ? `${x.user_limit ?? "–"} / ${x.installation_limit ?? "–"}` : "—";

async function SubscriptionDetail({ params }: { params: Params }) {
  const { company: id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const sub = await adminSubscription(id);
  const a = ADMIN.access;
  return (
    <>
      <AdminTitle title={sub.name} intro={s.intro}>
        <div className="flex flex-wrap gap-x-6">
          <Link href="/admin/tellimused" className="inline-flex min-h-11 items-center font-semibold text-k-green underline underline-offset-4">
            {s.back}
          </Link>
          <Link href={`/admin/companies/${sub.id}`} className="inline-flex min-h-11 items-center font-semibold text-k-green underline underline-offset-4">
            {s.companyCard}
          </Link>
        </div>
      </AdminTitle>

      <Section id="current" title={s.current}>
        <Rows
          rows={[
            [s.plan, planName(sub)],
            [s.status, <Badge key="s" tone={statusTone(sub.status)}>{a.statuses[sub.status]}</Badge>],
            [s.monthly, sub.monthly_price === null ? "—" : s.price(sub.monthly_price)],
            [s.users, s.usage(sub.seats_used, sub.user_limit)],
            [s.installations, s.usage(sub.installations_active, sub.installation_limit)],
            [s.start, fmtDate(sub.full_access_from)],
            [s.paidUntil, sub.indefinite ? s.indefinite : fmtDayNumeric(sub.paid_until)],
            [s.trialEnd, fmtDateTime(sub.trial_ends_at)],
            [a.invoice, sub.invoice_reference ?? "—"],
            [a.notes, sub.admin_notes ?? "—"],
          ]}
        />
      </Section>

      <Section id="change" title={s.change}>
        <SubscriptionForm
          companyId={sub.id}
          plans={sub.plans}
          active={sub.status === "active"}
          current={{
            plan: sub.plan,
            label: sub.plan_label,
            price: sub.monthly_price,
            userLimit: sub.user_limit,
            installationLimit: sub.installation_limit,
          }}
        />
      </Section>

      <Section id="note" title={s.note}>
        <p className="mb-4 max-w-3xl text-sm text-k-muted">{s.noteHint}</p>
        <AccessForms
          companyId={sub.id}
          trialEndsAt={sub.trial_ends_at}
          status={sub.status}
          invoiceReference={sub.invoice_reference}
          notes={sub.admin_notes}
        />
        {(sub.status === "trial" || sub.status === "active") && (
          <div className="mt-6">
            <ConfirmAction
              action={adminExpireAccess}
              fields={{ companyId: sub.id }}
              label={a.expire}
              title={`${a.expire}: ${sub.name}`}
              body={a.expireBody}
              confirmWord={sub.name}
              variant="destructive"
            />
          </div>
        )}
      </Section>

      <Section id="history" title={s.history}>
        {sub.history.length === 0 ? (
          <p className="text-k-muted">{s.historyEmpty}</p>
        ) : (
          <TableFrame label={s.history}>
            <thead>
              <tr>
                <th className={th}>{s.historyAt}</th>
                <th className={th}>{s.historyBy}</th>
                <th className={th}>{s.historyWhat}</th>
                <th className={th}>{s.historyPlan}</th>
                <th className={th}>{s.historyUntil}</th>
                <th className={th}>{s.historyLimits}</th>
              </tr>
            </thead>
            <tbody>
              {sub.history.map((h, i) => (
                <tr key={`${h.at}-${i}`}>
                  <td className={td}>{fmtDateTime(h.at)}</td>
                  <td className={td}>{h.by ?? "—"}</td>
                  <td className={td}>
                    {ADMIN.audit.actions[h.action] ?? h.action}
                    {h.mode && <span className="block text-k-muted">{s.modes[h.mode] ?? h.mode}</span>}
                  </td>
                  <td className={td}>{s.arrow(snapPlan(h.before), snapPlan(h.after))}</td>
                  <td className={td}>{s.arrow(snapUntil(h.before), snapUntil(h.after))}</td>
                  <td className={`${td} tabular-nums`}>{s.arrow(snapLimits(h.before), snapLimits(h.after))}</td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </Section>
    </>
  );
}

export default function AdminSubscriptionPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<LoadingBlock lines={6} />}>
      <SubscriptionDetail params={params} />
    </Suspense>
  );
}
