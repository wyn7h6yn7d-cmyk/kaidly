"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createInvitation } from "@/lib/actions/organisations";
import type { ActionState } from "@/lib/actions/state";
import type { Role } from "@/lib/auth/roles";
import { formatDate, t } from "@/lib/i18n";

type Result = ActionState<{ token: string; expiresAt: string }>;

export function InviteForm({ organisationId, roles }: { organisationId: string; roles: Role[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(createInvitation, {});
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
        <Field id="invite-email" label={copy.email}>
          <Input
            id="invite-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            required
            aria-invalid={state.fields?.email}
            aria-describedby="invite-email-hint"
          />
        </Field>
        <Field id="invite-role" label={copy.role}>
          <Select id="invite-role" name="role" defaultValue="operator">
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
        <p id="invite-email-hint" className="text-sm text-k-muted sm:col-span-3">
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
