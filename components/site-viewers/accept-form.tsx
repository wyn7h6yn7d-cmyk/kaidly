"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { acceptSiteViewerInvitation } from "@/lib/actions/site-viewers";
import { initialState } from "@/lib/actions/state";
import { useT } from "@/lib/i18n/client";

export function AcceptSiteViewerInvitationForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(acceptSiteViewerInvitation, initialState);
  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.app.viewerInvite.accepting : t.app.viewerInvite.accept}
      </Button>
      <FormMessage code={state.errorCode} />
    </form>
  );
}
