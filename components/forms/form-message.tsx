"use client";

import { CircleCheck } from "lucide-react";
import type { ErrorCode } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

/** An action's error (translated from its code), a client-side error text, or a success line. */
export function FormMessage({
  code,
  error,
  success,
  values,
}: {
  code?: ErrorCode;
  error?: string;
  success?: string;
  values?: Record<string, string | number>;
}) {
  const t = useT();
  const raw = code ? t.errors[code] : error;
  const text = raw && values ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m)) : raw;
  if (text) {
    return (
      <p role="alert" className="border-l-4 border-k-danger bg-k-surface px-3 py-2 text-sm text-k-ink">
        {text}
      </p>
    );
  }
  if (success) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-medium text-k-green">
        <CircleCheck className="size-4" aria-hidden="true" />
        {success}
      </p>
    );
  }
  return null;
}
