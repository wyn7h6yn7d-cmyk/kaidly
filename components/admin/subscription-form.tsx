"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApplySubscription, adminPreviewSubscription, type SubscriptionPreview, type SubscriptionState } from "@/lib/actions/admin";
import { fmtDayNumeric } from "@/lib/admin/format";
import { ADMIN } from "@/lib/admin/strings";

const s = ADMIN.subs;
const select = "min-h-11 w-full rounded-sm border border-k-line bg-k-surface px-2 text-base";
const PLAN_NAMES: Record<string, string> = { start: "Start", team: "Team", pro: "Pro", business: "Business", custom: "Custom" };

type FixedPlan = { plan: string; monthly_price: number; user_limit: number; installation_limit: number };
type Values = {
  plan: string;
  label: string;
  price: string;
  userLimit: string;
  installationLimit: string;
  period: string;
  paidUntil: string;
  start: string;
};

function Summary({ p }: { p: SubscriptionPreview }) {
  const name = p.plan === "custom" ? `${p.plan_label} (Custom)` : PLAN_NAMES[p.plan];
  const warnings = [
    p.seats_used > p.user_limit ? s.overLimit(s.users, p.seats_used, p.user_limit) : null,
    p.installations_active > p.installation_limit ? s.overLimit(s.installations, p.installations_active, p.installation_limit) : null,
  ].filter(Boolean) as string[];
  return (
    <div className="flex flex-col gap-1" data-testid="subscription-summary">
      <p className="text-sm font-semibold uppercase tracking-wider text-k-muted">{s.modes[p.mode]}</p>
      <p className="text-xl font-bold">{name}</p>
      <p>{s.price(p.monthly_price)}</p>
      <p>{s.summaryUsers(p.user_limit)}</p>
      <p>{s.summaryInstallations(p.installation_limit)}</p>
      {p.months && <p>{s.summaryPeriod(p.months)}</p>}
      {p.mode === "activate" && p.start && <p>{s.summaryFrom(fmtDayNumeric(p.start))}</p>}
      <p className="font-semibold">{p.mode === "plan_only" ? s.summaryUnchanged : s.summaryUntil(fmtDayNumeric(p.paid_until))}</p>
      {warnings.map((w) => (
        <p key={w} className="mt-2 border-l-4 border-k-warn pl-3 text-sm">
          {w}
        </p>
      ))}
    </div>
  );
}

function Hidden({ companyId, values }: { companyId: string; values: Values }) {
  return (
    <>
      <input type="hidden" name="companyId" value={companyId} />
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

/** Plan, limits and paid period for one company: fill in → "Vaata üle" → confirm → saved. */
export function SubscriptionForm({
  companyId,
  plans,
  current,
  active,
}: {
  companyId: string;
  plans: FixedPlan[];
  current: { plan: string | null; label: string | null; price: number | null; userLimit: number | null; installationLimit: number | null };
  active: boolean;
}) {
  const [values, setValues] = useState<Values>({
    plan: current.plan ?? "pro",
    label: current.label ?? "",
    price: current.plan === "custom" && current.price !== null ? String(current.price) : "",
    userLimit: current.plan === "custom" && current.userLimit !== null ? String(current.userLimit) : "",
    installationLimit: current.plan === "custom" && current.installationLimit !== null ? String(current.installationLimit) : "",
    period: active ? "none" : "1",
    paidUntil: "",
    start: "",
  });
  // A preview belongs to the values it was made from; editing anything invalidates it.
  const [previewFor, setPreviewFor] = useState<Values | null>(null);
  const [preview, runPreview, previewing] = useActionState<SubscriptionState, FormData>(adminPreviewSubscription, {});
  const [applied, apply, applying] = useActionState<SubscriptionState, FormData>(async (prev, formData) => {
    const result = await adminApplySubscription(prev, formData);
    // Saved: the summary is spent; a further change starts with a new review.
    if (result.ok) setPreviewFor(null);
    return result;
  }, {});
  const shown = preview.preview && previewFor === values ? preview.preview : null;
  const dialog = useRef<HTMLDialogElement>(null);
  // No native (pre-hydration) submit: method="post" and the buttons wait for hydration.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (applied.ok) dialog.current?.close();
  }, [applied]);

  const set = (name: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));
  const fixed = plans.find((p) => p.plan === values.plan);
  const expected = shown ? `${shown.mode}|${shown.paid_until ?? ""}|${shown.user_limit}|${shown.installation_limit}` : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <form
        // onSubmit, not a form action: React resets a form after an action, which would
        // show different plan/period values than the ones in the summary.
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => {
            setPreviewFor(values);
            runPreview(formData);
          });
        }}
        className="flex min-w-0 flex-col gap-4 border border-k-line p-4"
      >
        <h3 className="font-bold">{s.change}</h3>
        <p className="text-sm text-k-muted">{s.changeIntro}</p>
        <input type="hidden" name="companyId" value={companyId} />

        <div className="grid gap-1">
          <Label htmlFor="sub-plan">{s.planField}</Label>
          <select id="sub-plan" name="plan" value={values.plan} onChange={set("plan")} className={select}>
            {["start", "team", "pro", "business", "custom"].map((p) => (
              <option key={p} value={p}>
                {PLAN_NAMES[p]}
              </option>
            ))}
          </select>
          {fixed && (
            <p className="text-sm text-k-muted" data-testid="fixed-plan-values">
              {s.fixedValues({ price: fixed.monthly_price, users: fixed.user_limit, installations: fixed.installation_limit })}
            </p>
          )}
        </div>

        {values.plan === "custom" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1 sm:col-span-2">
              <Label htmlFor="sub-label">{s.customLabel}</Label>
              <Input id="sub-label" name="label" maxLength={60} required value={values.label} onChange={set("label")} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="sub-price">{s.customPrice}</Label>
              <Input id="sub-price" name="price" inputMode="decimal" required value={values.price} onChange={set("price")} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="sub-users">{s.userLimit}</Label>
              <Input id="sub-users" name="userLimit" type="number" min={1} required value={values.userLimit} onChange={set("userLimit")} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="sub-installations">{s.installationLimit}</Label>
              <Input
                id="sub-installations"
                name="installationLimit"
                type="number"
                min={0}
                required
                value={values.installationLimit}
                onChange={set("installationLimit")}
              />
            </div>
          </div>
        )}

        <div className="grid gap-1">
          <Label htmlFor="sub-period">{s.period}</Label>
          <select id="sub-period" name="period" value={values.period} onChange={set("period")} className={select}>
            {Object.entries(s.periods).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-sm text-k-muted">{s.periodHint}</p>
        </div>
        {values.period === "date" && (
          <div className="grid gap-1">
            <Label htmlFor="sub-until">{s.paidUntilField}</Label>
            <Input id="sub-until" name="paidUntil" type="date" required value={values.paidUntil} onChange={set("paidUntil")} />
          </div>
        )}
        {!active && values.period !== "none" && (
          <div className="grid gap-1">
            <Label htmlFor="sub-start">{s.startField}</Label>
            <Input id="sub-start" name="start" type="date" value={values.start} onChange={set("start")} />
          </div>
        )}
        <FormMessage error={preview.error ? ADMIN.errors[preview.error] : undefined} />
        <div>
          <Button type="submit" variant="outline" disabled={previewing || !hydrated}>
            {s.review}
          </Button>
        </div>
      </form>

      <div className="min-w-0 border border-k-line p-4" aria-live="polite">
        <h3 className="mb-3 font-bold">{s.summary}</h3>
        {shown ? (
          <>
            <Summary p={shown} />
            <Button type="button" variant="dark" className="mt-4" onClick={() => dialog.current?.showModal()}>
              {s.apply}
            </Button>
          </>
        ) : (
          <p className="text-sm text-k-muted">{s.changeIntro}</p>
        )}
        <div className="mt-3">
          <FormMessage error={applied.error ? ADMIN.errors[applied.error] : undefined} success={applied.ok ? s.saved : undefined} />
        </div>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="sub-apply-title"
        className="w-[min(32rem,calc(100vw-2rem))] rounded-sm border border-k-line bg-k-surface p-0 text-k-ink backdrop:bg-k-ink/50"
      >
        <form
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => apply(formData));
          }}
          className="flex flex-col gap-4 p-5"
        >
          <Hidden companyId={companyId} values={values} />
          <input type="hidden" name="expected" value={expected} />
          <h2 id="sub-apply-title" className="text-lg font-bold">
            {s.applyTitle}
          </h2>
          <p className="text-k-muted">{s.applyBody}</p>
          {shown && <Summary p={shown} />}
          <FormMessage error={applied.error ? ADMIN.errors[applied.error] : undefined} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="dark" disabled={applying || !shown || !hydrated}>
              {s.apply}
            </Button>
            <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>
              {ADMIN.confirm.cancel}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
