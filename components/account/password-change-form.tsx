"use client";

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { useFieldId } from "@/components/forms/use-field-id";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { changePassword, resendReauthCode, type PasswordChangeData } from "@/lib/actions/account";
import type { ActionState } from "@/lib/actions/state";
import type { ErrorCode } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation/constants";

/** Supabase limits reauthentication e-mails; the button waits this long between codes. */
const RESEND_COOLDOWN_MS = 60_000;

type State = ActionState<PasswordChangeData> & { sentAt?: number };

/**
 * Password change with the current password, plus Supabase's reauthentication step when
 * Secure password change requires it (session older than 24 h): Supabase e-mails a code,
 * the user types it here, and the same form submits again with it (`nonce`).
 *
 * Typed passwords live only in the form fields: they are never put into React state, and
 * the form is cleared after every result except the code step (which needs them again).
 */
export function PasswordChangeForm() {
  const t = useT();
  const copy = t.app.account;
  const id = useFieldId();
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [state, dispatch, pending] = useActionState<State, FormData>(async (previous, formData) => {
    try {
      const result: State = await changePassword(previous, formData);
      return result.data?.sent ? { ...result, sentAt: Date.now() } : { ...result, sentAt: previous.sentAt };
    } catch (error) {
      unstable_rethrow(error);
      return { ok: false, errorCode: "network", data: previous.data, sentAt: previous.sentAt };
    }
  }, {});
  const [cancelled, setCancelled] = useState<State | null>(null);
  const reauth = Boolean(state.data?.reauth) && cancelled !== state;

  const [resending, startResend] = useTransition();
  // The latest "send a new code" outcome; it replaces the step's message until the next submit.
  const [resend, setResend] = useState<{ at: number; after?: State; ok?: boolean; errorCode?: ErrorCode }>({ at: 0 });
  const [now, setNow] = useState(() => Date.now());
  const resent = resend.after === state ? resend : null;
  const lastSent = Math.max(state.sentAt ?? 0, resend.ok ? resend.at : 0);
  const wait = Math.ceil((lastSent + RESEND_COOLDOWN_MS - now) / 1000);

  useEffect(() => {
    if (!reauth) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [reauth]);

  // Clear the typed passwords after a result, except while the code step needs them.
  useEffect(() => {
    if (state === cancelled || (!state.data?.reauth && (state.ok || state.errorCode))) form.current?.reset();
    if (state.data?.sent) heading.current?.focus();
  }, [state, cancelled]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  function sendNewCode() {
    startResend(async () => {
      try {
        const result = await resendReauthCode();
        setResend({ at: Date.now(), after: state, ok: result.ok, errorCode: result.errorCode });
      } catch (error) {
        unstable_rethrow(error);
        setResend({ at: Date.now(), after: state, ok: false, errorCode: "network" });
      }
      setNow(Date.now());
    });
  }


  return (
    <form ref={form} onSubmit={submit} className="flex max-w-lg flex-col gap-5">
      <Field id={id("currentPassword")} label={copy.currentPassword}>
        <PasswordInput
          id={id("currentPassword")}
          name="currentPassword"
          autoComplete="current-password"
          required
          readOnly={reauth}
          aria-invalid={state.fields?.currentPassword}
        />
      </Field>
      <Field id={id("newPassword")} label={copy.newPassword} hint={t.auth.signUp.passwordHint}>
        <PasswordInput
          id={id("newPassword")}
          name="newPassword"
          autoComplete="new-password"
          required
          readOnly={reauth}
          minLength={MIN_PASSWORD_LENGTH}
          aria-invalid={state.fields?.newPassword}
          aria-describedby={`${id("newPassword")}-hint`}
        />
      </Field>
      <Field id={id("confirmPassword")} label={copy.confirmPassword}>
        <PasswordInput
          id={id("confirmPassword")}
          name="confirmPassword"
          autoComplete="new-password"
          required
          readOnly={reauth}
          minLength={MIN_PASSWORD_LENGTH}
          aria-invalid={state.fields?.confirmPassword}
        />
      </Field>

      {reauth ? (
        <section
          aria-labelledby={id("reauthTitle")}
          className="flex flex-col gap-4 border-l-4 border-k-volt bg-k-surface px-4 py-4"
        >
          <div>
            <h3 id={id("reauthTitle")} ref={heading} tabIndex={-1} className="text-base font-bold outline-none">
              {copy.reauthTitle}
            </h3>
            <p className="mt-1 text-k-muted">{copy.reauthBody}</p>
          </div>
          <Field id={id("nonce")} label={copy.reauthCode} hint={copy.reauthCodeHint}>
            <Input
              id={id("nonce")}
              name="nonce"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              required
              aria-invalid={state.fields?.nonce}
              aria-describedby={`${id("nonce")}-hint`}
              className="max-w-48 font-mono tracking-widest"
            />
          </Field>
          <FormMessage
            code={resent ? resent.errorCode : state.errorCode}
            success={resent?.ok ? copy.reauthResent : undefined}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Button type="submit" disabled={pending}>
              {pending ? t.app.saving : copy.reauthSubmit}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={sendNewCode} disabled={resending || pending || wait > 0}>
              {copy.reauthResend}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCancelled(state)}>
              {copy.reauthCancel}
            </Button>
          </div>
          {wait > 0 && (
            <p aria-live="polite" className="text-sm text-k-muted">
              {copy.reauthResendWait(wait)}
            </p>
          )}
        </section>
      ) : (
        <>
          <FormMessage code={state.errorCode} success={state.ok ? copy.passwordChanged : undefined} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? t.app.saving : copy.passwordSubmit}
            </Button>
            <Link href="/auth/forgot-password" className="text-sm font-semibold text-k-green underline underline-offset-4">
              {copy.forgotPassword}
            </Link>
          </div>
        </>
      )}
    </form>
  );
}
