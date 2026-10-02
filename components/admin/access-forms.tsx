"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminActivateAccess, adminExtendTrial, adminSetAccessReference, type AdminActionState } from "@/lib/actions/admin";
import { ADMIN } from "@/lib/admin/strings";

const a = ADMIN.access;
const select = "min-h-11 w-full rounded-sm border border-k-line bg-k-surface px-2 text-base";

function Message({ state }: { state: AdminActionState }) {
  return <FormMessage error={state.error ? ADMIN.errors[state.error] : undefined} success={state.ok ? ADMIN.user.done : undefined} />;
}

/** Activation, trial extension and the invoice reference for one company. */
export function AccessForms({
  companyId,
  trialEndsAt,
  status,
  invoiceReference,
  notes,
}: {
  companyId: string;
  trialEndsAt: string;
  status: string;
  invoiceReference: string | null;
  notes: string | null;
}) {
  const [activateState, activate, activating] = useActionState(adminActivateAccess, {});
  const [extendState, extend, extending] = useActionState(adminExtendTrial, {});
  const [refState, saveRef, saving] = useActionState(adminSetAccessReference, {});
  const [period, setPeriod] = useState("12");
  const [extendBy, setExtendBy] = useState("14");

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form action={activate} className="flex flex-col gap-4 border border-k-line p-4">
        <h3 className="font-bold">{a.activate}</h3>
        <p className="text-sm text-k-muted">{a.activateBody}</p>
        <input type="hidden" name="companyId" value={companyId} />
        <div className="grid gap-1">
          <Label htmlFor="access-period">{a.period}</Label>
          <select id="access-period" name="period" value={period} onChange={(e) => setPeriod(e.target.value)} className={select}>
            {Object.entries(a.periods).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {period === "custom" && (
          <div className="grid gap-1">
            <Label htmlFor="access-until">{a.customDate}</Label>
            <Input id="access-until" name="until" type="date" required />
          </div>
        )}
        <div className="grid gap-1">
          <Label htmlFor="access-invoice">{a.invoice}</Label>
          <Input id="access-invoice" name="invoiceReference" maxLength={200} defaultValue={invoiceReference ?? ""} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="access-notes">{a.notes}</Label>
          <Textarea id="access-notes" name="notes" rows={2} maxLength={2000} defaultValue={notes ?? ""} />
        </div>
        <Message state={activateState} />
        <div>
          <Button type="submit" variant="dark" disabled={activating}>
            {a.activate}
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-8">
        {status !== "active" && (
          <form action={extend} className="flex flex-col gap-4 border border-k-line p-4">
            <h3 className="font-bold">{a.extend}</h3>
            <p className="text-sm text-k-muted">{a.extendBody}</p>
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="currentEnd" value={trialEndsAt} />
            <div className="grid gap-1">
              <Label htmlFor="access-extend">{a.period}</Label>
              <select id="access-extend" name="extend" value={extendBy} onChange={(e) => setExtendBy(e.target.value)} className={select}>
                {Object.entries(a.extendOptions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {extendBy === "custom" && (
              <div className="grid gap-1">
                <Label htmlFor="access-extend-until">{a.customDate}</Label>
                <Input id="access-extend-until" name="until" type="date" required />
              </div>
            )}
            <Message state={extendState} />
            <div>
              <Button type="submit" variant="outline" disabled={extending}>
                {a.extend}
              </Button>
            </div>
          </form>
        )}

        <form action={saveRef} className="flex flex-col gap-4 border border-k-line p-4">
          <h3 className="font-bold">{a.reference}</h3>
          <input type="hidden" name="companyId" value={companyId} />
          <div className="grid gap-1">
            <Label htmlFor="ref-invoice">{a.invoice}</Label>
            <Input id="ref-invoice" name="invoiceReference" maxLength={200} defaultValue={invoiceReference ?? ""} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="ref-notes">{a.notes}</Label>
            <Textarea id="ref-notes" name="notes" rows={2} maxLength={2000} defaultValue={notes ?? ""} />
          </div>
          <Message state={refState} />
          <div>
            <Button type="submit" variant="outline" disabled={saving}>
              {a.save}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
