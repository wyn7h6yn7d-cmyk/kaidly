import type { ZodError } from "zod";
import type { ErrorCode } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { fieldErrors } from "@/lib/validation/common";

/** Result of a form Server Action, consumed with React's useActionState. */
export type ActionState<T = undefined> = {
  ok?: boolean;
  /** Application-controlled message, never raw database text. */
  error?: string;
  /** Fields that failed validation. */
  fields?: Record<string, true>;
  data?: T;
  /** Keep the submitted values in the form although the action succeeded (client-side). */
  keepValues?: boolean;
};

export const initialState: ActionState = {};

export function failure(code: ErrorCode, fields?: Record<string, true>): ActionState<never> {
  return { ok: false, error: t.errors[code], fields };
}

/**
 * Validation failure. Schemas mark special cases with an issue message (e.g. "future");
 * `messages` maps those to user text, anything else is the generic invalid-input message.
 */
export function invalidInput(error: ZodError, messages: Record<string, string> = {}): ActionState<never> {
  const special = error.issues.map((issue) => issue.message).find((m) => Object.hasOwn(messages, m));
  return {
    ok: false,
    error: special ? messages[special] : t.errors.invalid_input,
    fields: fieldErrors(error),
  };
}
