"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFieldId } from "@/components/forms/use-field-id";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { AuthHeading, FormError } from "./auth-heading";

type Step =
  | { kind: "loading" }
  | { kind: "verify"; factorId: string }
  | { kind: "setup"; factorId: string; qr: string; secret: string }
  | { kind: "done" };

/**
 * Two-step sign-in (TOTP, Supabase Auth MFA). With a verified authenticator: asks for the
 * code (aal1 → aal2). Without one: enrols a new authenticator (QR code + key) and verifies
 * it. Unfinished enrolments are removed first. Then continues to `next` (already
 * validated on the server). docs/MFA.md
 */
export function TwoStepFlow({ next, adminRequired }: { next: string; adminRequired: boolean }) {
  const t = useT();
  const id = useFieldId();
  const router = useRouter();
  const copy = t.auth.twoStep;
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Enrol at most once per page view (React may run effects twice in development).
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const mfa = createClient().auth.mfa;
      const [{ data: aal }, { data: factors }] = await Promise.all([mfa.getAuthenticatorAssuranceLevel(), mfa.listFactors()]);
      if (aal?.currentLevel === "aal2") return setStep({ kind: "done" });
      const verified = factors?.totp ?? [];
      if (verified.length > 0) return setStep({ kind: "verify", factorId: verified[0].id });
      for (const f of factors?.all ?? []) {
        if (f.status === "unverified") await mfa.unenroll({ factorId: f.id });
      }
      const { data, error: enrollError } = await mfa.enroll({ factorType: "totp", friendlyName: `KAIDLY ${new Date().toISOString()}` });
      if (enrollError || !data) return setError(t.errors.unknown);
      setStep({ kind: "setup", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })().catch(() => setError(t.errors.unknown));
  }, [t.errors.unknown]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || (step.kind !== "verify" && step.kind !== "setup")) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId: step.factorId, code: code.trim() });
    setBusy(false);
    if (verifyError) {
      setError(t.errors.mfa_code_invalid);
      return;
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <>
      <AuthHeading title={copy.title} description={step.kind === "setup" ? copy.setupDescription : copy.verifyDescription} />
      {adminRequired && step.kind !== "done" && <p className="mb-5 border-l-4 border-k-volt bg-k-paper-2 px-3 py-2 text-sm">{copy.adminRequired}</p>}

      {step.kind === "loading" && !error && <p className="text-k-muted">{copy.loading}</p>}

      {step.kind === "done" && (
        <div className="flex flex-col gap-4">
          <p>{copy.enabled}</p>
          <Button onClick={() => router.replace(next)}>{copy.continue}</Button>
        </div>
      )}

      {step.kind === "setup" && (
        <div className="mb-5 flex flex-col items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI from Supabase */}
          <img src={step.qr} alt={copy.qrAlt} width={180} height={180} className="border border-k-line bg-white p-2" />
          <div className="w-full min-w-0">
            <p className="text-sm font-semibold">{copy.secret}</p>
            <code data-testid="totp-secret" className="mt-1 block break-all bg-k-paper-2 px-2 py-1 font-mono text-sm">
              {step.secret}
            </code>
          </div>
        </div>
      )}

      {(step.kind === "verify" || step.kind === "setup") && (
        <form method="post" onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid gap-2">
            <Label htmlFor={id("code")}>{copy.code}</Label>
            <Input
              id={id("code")}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="font-mono text-lg tracking-[0.3em]"
            />
          </div>
          <FormError message={error} />
          <Button type="submit" size="lg" disabled={busy || code.length !== 6}>
            {busy ? copy.submitting : copy.submit}
          </Button>
        </form>
      )}
      {step.kind === "loading" && <FormError message={error} />}

      <button
        type="button"
        className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-k-green underline underline-offset-4"
        onClick={async () => {
          await createClient().auth.signOut({ scope: "local" });
          router.replace("/auth/login");
          router.refresh();
        }}
      >
        {copy.signOut}
      </button>
    </>
  );
}
