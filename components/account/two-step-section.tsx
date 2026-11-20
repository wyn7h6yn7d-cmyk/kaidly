"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

/** Account page: two-step sign-in on/off (TOTP). Turning it on goes through /auth/kaheastmeline. */
export function TwoStepSection({ isAdmin }: { isAdmin: boolean }) {
  const t = useT();
  const router = useRouter();
  const copy = t.app.account;
  const [factorIds, setFactorIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    createClient()
      .auth.mfa.listFactors()
      .then(({ data }) => setFactorIds((data?.totp ?? []).map((f) => f.id)))
      .catch(() => setFactorIds([]));
  }, []);

  if (factorIds === null) return <p className="text-k-muted">{t.auth.twoStep.loading}</p>;
  const on = factorIds.length > 0;
  return (
    <div className="flex flex-col items-start gap-3" data-testid="two-step">
      <p className="font-semibold">{on ? copy.twoStepOn : copy.twoStepOff}</p>
      {isAdmin && <p className="text-sm text-k-muted">{copy.twoStepAdminNote}</p>}
      {on ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm(copy.twoStepDisableConfirm)) return;
            setBusy(true);
            setFailed(false);
            const client = createClient();
            for (const factorId of factorIds) {
              const { error } = await client.auth.mfa.unenroll({ factorId });
              if (error) setFailed(true);
            }
            await client.auth.refreshSession();
            const { data } = await client.auth.mfa.listFactors();
            setFactorIds((data?.totp ?? []).map((f) => f.id));
            setBusy(false);
            router.refresh();
          }}
        >
          {copy.twoStepDisable}
        </Button>
      ) : (
        <Button asChild size="sm">
          <Link href="/auth/kaheastmeline?next=/konto">{copy.twoStepEnable}</Link>
        </Button>
      )}
      {failed && <p role="alert" className="text-sm">{t.errors.unknown}</p>}
    </div>
  );
}
