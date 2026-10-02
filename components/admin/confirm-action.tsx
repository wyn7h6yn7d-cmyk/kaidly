"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminActionState } from "@/lib/actions/admin";
import { ADMIN } from "@/lib/admin/strings";

/**
 * A platform-admin action behind a real confirmation dialog (native <dialog>: focus is
 * trapped, Escape cancels). High-impact actions also require typing a word — checked
 * again on the server — so nothing happens from a stray click.
 */
export function ConfirmAction({
  action,
  fields,
  label,
  title,
  body,
  confirmWord,
  variant = "outline",
  success = ADMIN.user.done,
}: {
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  fields: Record<string, string>;
  label: string;
  title: string;
  body: string;
  /** When set, the confirm button stays disabled until this is typed. */
  confirmWord?: string;
  variant?: ButtonProps["variant"];
  success?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [state, formAction, pending] = useActionState(action, {});
  const inputId = `confirm-${label.replace(/\W+/g, "-")}-${Object.values(fields).join("-")}`;

  useEffect(() => {
    if (state.ok) dialog.current?.close();
  }, [state]);

  const ready = !confirmWord || typed.trim().toLowerCase() === confirmWord.toLowerCase();
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        size="sm"
        variant={variant}
        onClick={() => {
          setTyped("");
          dialog.current?.showModal();
        }}
      >
        {label}
      </Button>
      <FormMessage success={state.ok ? success : undefined} />
      <dialog
        ref={dialog}
        aria-labelledby={`${inputId}-title`}
        className="w-[min(32rem,calc(100vw-2rem))] rounded-sm border border-k-line bg-k-surface p-0 text-k-ink backdrop:bg-k-ink/50"
      >
        <form action={formAction} className="flex flex-col gap-4 p-5">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 id={`${inputId}-title`} className="text-lg font-bold">
            {title}
          </h2>
          <p className="text-k-muted">{body}</p>
          {confirmWord && (
            <div className="grid gap-2">
              <Label htmlFor={inputId}>{ADMIN.confirm.typeToConfirm(confirmWord)}</Label>
              <Input
                id={inputId}
                name="confirmation"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </div>
          )}
          <FormMessage error={state.error ? ADMIN.errors[state.error] : undefined} />
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>
              {ADMIN.confirm.cancel}
            </Button>
            <Button type="submit" variant={variant === "destructive" ? "destructive" : "dark"} disabled={!ready || pending}>
              {ADMIN.confirm.confirm}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
