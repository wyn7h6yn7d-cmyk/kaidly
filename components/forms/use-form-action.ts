"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/state";

type Submitted<T> = ActionState<T> & { values?: Record<string, string> };

/**
 * useActionState for our Server Actions, keeping what the user typed when the action
 * fails. React resets a form after every action, so without this a validation error
 * would also wipe the fields. Use `value(name, fallback)` as each field's defaultValue.
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
      const result = await action(previous, formData);
      if (result.ok !== false && !result.keepValues) return result;
      const values: Record<string, string> = {};
      formData.forEach((entry, key) => {
        if (typeof entry === "string") values[key] = entry;
      });
      return { ...result, values };
    },
    {},
  );

  const value = (name: string, fallback?: string | null) => state.values?.[name] ?? fallback ?? "";
  return [state, formAction, pending, value] as const;
}
