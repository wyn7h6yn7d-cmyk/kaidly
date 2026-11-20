"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PricingRow = {
  plan: string;
  name: string;
  audience: string;
  /** Formatted on the server in the page's language. */
  monthlyPrice: string;
  annualPrice: string;
  users: string;
  installations: string;
  recommended: boolean;
  /** mailto for the yearly (invoiced) plan; null when no contact address is configured. */
  annualHref: string | null;
};

export type PricingTableLabels = {
  billingLabel: string;
  billingMonthly: string;
  billingAnnual: string;
  perMonth: string;
  perYear: string;
  annualFree: string;
  annualInvoice: string;
  recommended: string;
  contactCta: string;
};

/**
 * The four fixed plans with a monthly / yearly switch. Values are computed on the server
 * (lib/plans.ts + dictionaries); this component only chooses which price to show. Without
 * JavaScript the monthly prices are shown. Yearly plans are invoiced (no online payments),
 * so each yearly plan offers "Võta ühendust" instead of a checkout.
 */
export function PricingTable({ rows, labels }: { rows: PricingRow[]; labels: PricingTableLabels }) {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const name = useId();
  const annual = period === "year";

  return (
    <>
      <fieldset className="mt-12 sm:mt-16">
        <legend className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-k-green">{labels.billingLabel}</legend>
        <div className="inline-flex border border-k-ink/70" data-testid="billing-period">
          {(["month", "year"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center px-5 text-[15px] font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                value === "year" && "border-l border-k-ink/70",
                period === value ? "bg-k-ink text-white" : "bg-k-paper text-k-ink hover:bg-k-paper-2",
              )}
            >
              <input
                type="radio"
                name={name}
                value={value}
                checked={period === value}
                onChange={() => setPeriod(value)}
                className="sr-only"
              />
              {value === "month" ? labels.billingMonthly : labels.billingAnnual}
            </label>
          ))}
        </div>
      </fieldset>

      <ul className="mt-6 grid grid-cols-1 divide-y divide-k-ink/20 border border-k-ink/70 bg-k-paper sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
        {rows.map((row, i) => (
          <li
            key={row.plan}
            aria-labelledby={`plan-${row.plan}`}
            data-plan={row.plan}
            className={cn(
              "relative flex min-w-0 flex-col gap-5 p-6 lg:p-8",
              // Rules between the columns of the sheet.
              i % 2 === 1 && "sm:border-l sm:border-k-ink/20",
              i >= 2 && "sm:border-t sm:border-k-ink/20 lg:border-t-0",
              i === 2 && "lg:border-l lg:border-k-ink/20",
              row.recommended && "bg-k-paper-2",
            )}
          >
            {row.recommended && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-k-volt" />}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={`plan-${row.plan}`} className="font-display text-2xl font-extrabold uppercase tracking-wide">
                {row.name}
              </h3>
              {row.recommended && (
                <span className="bg-k-volt px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-k-ink">{labels.recommended}</span>
              )}
            </div>
            <p className="-mt-2 text-k-muted lg:min-h-12">{row.audience}</p>
            <div>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-5xl font-extrabold tabular-nums" data-testid="plan-price">
                  {annual ? row.annualPrice : row.monthlyPrice}
                </span>
                <span className="text-base font-semibold text-k-muted">{annual ? labels.perYear : labels.perMonth}</span>
              </p>
              {annual && (
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  <span className="bg-k-volt px-2 py-0.5 font-bold text-k-ink">{labels.annualFree}</span>
                  <span className="py-0.5 text-k-muted">{labels.annualInvoice}</span>
                </p>
              )}
            </div>
            <ul className="divide-y divide-k-line border-y border-k-line text-[17px]">
              <li className="py-2.5">{row.users}</li>
              <li className="py-2.5">{row.installations}</li>
            </ul>
            {annual && row.annualHref && (
              <Button asChild variant="outline" className="mt-auto min-h-11">
                <a href={row.annualHref}>{labels.contactCta}</a>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
