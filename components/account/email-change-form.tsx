"use client";

import { useState } from "react";
import { Field } from "@/components/forms/field";
import { useFieldId } from "@/components/forms/use-field-id";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authErrorCode } from "@/lib/auth/errors";
import type { ErrorCode } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { emailChangeSchema } from "@/lib/validation/account";

/**
 * Requests an email change through Supabase Auth: the account (and its user id, companies
 * and records) stays the same; the new address takes effect once it is confirmed from the
 * link Auth sends. Until then the current address keeps working.
 */
export function EmailChangeForm({ currentEmail }: { currentEmail: string | null }) {
  const t = useT();
  const id = useFieldId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<ErrorCode | undefined>();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setSentTo(null);
    const parsed = emailChangeSchema.safeParse(email);
    if (!parsed.success) return setError("invalid_input");
    if (parsed.data === currentEmail?.toLowerCase()) return setError("email_unchanged");
    setPending(true);
    try {
      const { error } = await createClient().auth.updateUser(
        { email: parsed.data },
        { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/konto` },
      );
      if (error) return setError(authErrorCode(error));
      setSentTo(parsed.data);
      setEmail("");
    } catch (err) {
      setError(authErrorCode(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form method="post" onSubmit={submit} className="flex max-w-lg flex-col gap-5">
      <Field id={id("current")} label={t.app.account.currentEmail}>
        <Input id={id("current")} value={currentEmail ?? ""} readOnly />
      </Field>
      <Field id={id("email")} label={t.app.account.newEmail} hint={t.app.account.emailHint}>
        <Input
          id={id("email")}
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error === "invalid_input" || error === "email_unchanged" || undefined}
          aria-describedby={`${id("email")}-hint`}
        />
      </Field>
      <FormMessage code={error} success={sentTo ? t.app.account.emailSent(sentTo) : undefined} />
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? t.app.saving : t.app.account.emailSubmit}
        </Button>
      </div>
    </form>
  );
}
