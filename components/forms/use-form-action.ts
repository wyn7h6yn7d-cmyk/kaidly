"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/state";

type Submitted<T> = ActionState<T> & { values?: Record<string, string> };

function snapshot(formData: FormData) {
  const values: Record<string, string> = {};
  formData.forEach((entry, key) => {
    if (typeof entry === "string") values[key] = entry;
  });
  return values;
}

/**
 * useActionState for our Server Actions, keeping what the user typed when the action
 * fails. React resets a form after every action, so without this a validation error
 * would also wipe the fields. Use `value(name, fallback)` as each field's defaultValue.
 *
 * A lost connection (the action's request fails) becomes the "network" error with the
 * typed values kept, instead of an error page. Next.js redirects pass through.
 *
 * Selects also need `key={value(name, fallback)}`: React does not update a select's
 * default after mount, so without the remount a reset would silently restore the
 * original option.
 */
export function useFormAction<T = undefined>(
  action: (state: ActionState<T>, formData: FormData) => Promise<ActionState<T>>,
) {
  const [state, formAction, pending] = useActionState<Submitted<T>, FormData>(
    async (previous, formData) => {
      let result: ActionState<T>;
      try {
        result = await action(previous, formData);
      } catch (error) {
        unstable_rethrow(error);
        return { ok: false, errorCode: "network", values: snapshot(formData) };
      }
      if (result.ok !== false && !result.keepValues) return result;
      return { ...result, values: snapshot(formData) };
    },
    {},
  );

  const value = (name: string, fallback?: string | null) => state.values?.[name] ?? fallback ?? "";
  return [state, formAction, pending, value] as const;
}
