"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/lib/actions/organisations";
import { initialState } from "@/lib/actions/state";
import { useT } from "@/lib/i18n/client";


export function AcceptInvitationForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(acceptInvitation, initialState);
  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.app.invite.accepting : t.app.invite.accept}
      </Button>
      <FormMessage code={state.errorCode} />
    </form>
  );
}
