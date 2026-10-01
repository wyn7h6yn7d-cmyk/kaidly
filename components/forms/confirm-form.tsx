"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Button, type ButtonProps } from "@/components/ui/button";
import { type ActionState, initialState } from "@/lib/actions/state";

/**
 * A single-button form for destructive or significant actions (remove, revoke, leave):
 * asks for confirmation, submits hidden fields, shows the server's error inline.
 */
export function ConfirmForm({
  action,
  fields,
  confirm,
  label,
  pendingLabel,
  variant = "outline",
  size = "sm",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  confirm: string;
  label: string;
  pendingLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
      className="flex flex-col items-start gap-2"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {pending && pendingLabel ? pendingLabel : label}
      </Button>
      <FormMessage error={state.error} />
    </form>
  );
}
