"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { clearSessionDrafts } from "@/components/forms/use-session-draft";
import { createClient } from "@/lib/supabase/client";

export function SignOutHere() {
  const t = useT();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        clearSessionDrafts();
        await createClient().auth.signOut({ scope: "local" });
        router.replace("/auth/login");
        router.refresh();
      }}
    >
      {t.common.signOut}
    </Button>
  );
}
