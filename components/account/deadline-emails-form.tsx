"use client";

import { unstable_rethrow } from "next/navigation";
import { startTransition, useActionState, useOptimistic } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { setDeadlineEmails } from "@/lib/actions/account";
import type { ActionState } from "@/lib/actions/state";
import { useT } from "@/lib/i18n/client";

type State = ActionState<{ enabled: boolean }>;

/**
 * The user's own "deadline reminder e-mails" switch. Saves on change; the switch shows the
 * new value while saving, is locked until the save finishes (no double submits) and falls
 * back to the stored value if saving fails.
 */
export function DeadlineEmailsForm({ enabled }: { enabled: boolean }) {
  const t = useT();
  const copy = t.app.account;
  const id = useFieldId();
  const [state, dispatch, pending] = useActionState<State, FormData>(async (previous, formData) => {
    try {
      return await setDeadlineEmails(previous, formData);
    } catch (error) {
      unstable_rethrow(error);
      return { ok: false, errorCode: "network", data: { enabled: formData.get("previous") !== "false" } };
    }
  }, {});
  const saved = state.data?.enabled ?? enabled;
  const [shown, setShown] = useOptimistic(saved);

  function change(next: boolean) {
    const formData = new FormData();
    formData.set("enabled", String(next));
    formData.set("previous", String(saved));
    startTransition(() => {
      setShown(next);
      dispatch(formData);
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <label htmlFor={id("deadlineEmails")} className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          id={id("deadlineEmails")}
          type="checkbox"
          role="switch"
          name="deadlineEmails"
          checked={shown}
          disabled={pending}
          aria-describedby={`${id("deadlineEmails")}-body ${id("deadlineEmails")}-status`}
          onChange={(event) => change(event.currentTarget.checked)}
          className="mt-0.5 size-6 shrink-0 cursor-pointer accent-k-green disabled:cursor-wait"
        />
        <span className="min-w-0">
          <span className="block font-semibold">{copy.deadlineEmails}</span>
          <span id={`${id("deadlineEmails")}-body`} className="mt-0.5 block text-k-muted">
            {copy.deadlineEmailsBody}
          </span>
        </span>
      </label>
      <p id={`${id("deadlineEmails")}-status`} aria-live="polite" className="min-h-5 text-sm text-k-muted">
        {pending ? t.app.saving : !shown ? copy.deadlineEmailsOff : state.ok ? t.app.saved : ""}
      </p>
      <FormMessage code={state.errorCode} />
      <p className="text-sm text-k-muted">{copy.deadlineEmailsAccountMail}</p>
    </div>
  );
}
