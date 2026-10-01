"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createInvitation } from "@/lib/actions/organisations";
import type { Role } from "@/lib/auth/roles";
import { formatDate, t } from "@/lib/i18n";
import { useFieldId } from "@/components/forms/use-field-id";

export function InviteForm({ organisationId, roles }: { organisationId: string; roles: Role[] }) {
  const id = useFieldId();
  const [state, action, pending, value] = useFormAction(createInvitation);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const copy = t.app.invitations;

  // state.data only exists after the action ran in the browser, so window is available.
  const link =
    state.data && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${state.data.token}`
      : null;
  const copied = copiedToken !== null && copiedToken === state.data?.token;

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="grid gap-5 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <input type="hidden" name="organisationId" value={organisationId} />
        <Field id={id("invite-email")} label={copy.email}>
          <Input
            id={id("invite-email")}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            required
            defaultValue={value("email")}
            aria-invalid={state.fields?.email}
            aria-describedby={`${id("invite-email")}-hint`}
          />
        </Field>
        <Field id={id("invite-role")} label={copy.role}>
          <Select
            key={value("role", "operator")}
            id={id("invite-role")}
            name="role"
            defaultValue={value("role", "operator")}
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {t.roles[role]}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? copy.submitting : copy.submit}
        </Button>
        <p id={id("invite-email-hint")} className="text-sm text-k-muted sm:col-span-3">
          {copy.emailHint}
        </p>
      </form>
      <FormMessage error={state.error} />

      {link && state.data && (
        <section aria-live="polite" className="border-l-4 border-k-volt bg-k-surface p-4 sm:p-5">
          <h3 className="font-bold">{copy.linkTitle}</h3>
          <p className="mt-1 text-sm text-k-muted">{copy.linkBody}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={link} aria-label={copy.linkTitle} onFocus={(e) => e.currentTarget.select()} className="font-mono text-sm" />
            <Button
              type="button"
              variant="dark"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopiedToken(state.data?.token ?? null);
              }}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? copy.copied : copy.copy}
            </Button>
          </div>
          <p className="mt-3 text-sm text-k-muted">{copy.validUntil(formatDate(state.data.expiresAt))}</p>
        </section>
      )}
    </div>
  );
}
