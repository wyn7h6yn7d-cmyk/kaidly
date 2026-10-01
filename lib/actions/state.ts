import type { ErrorCode } from "@/lib/i18n";
import { t } from "@/lib/i18n";

/** Result of a form Server Action, consumed with React's useActionState. */
export type ActionState<T = undefined> = {
  ok?: boolean;
  /** Application-controlled message, never raw database text. */
  error?: string;
  /** Fields that failed validation. */
  fields?: Record<string, true>;
  data?: T;
};

export const initialState: ActionState = {};

export function failure(code: ErrorCode, fields?: Record<string, true>): ActionState<never> {
  return { ok: false, error: t.errors[code], fields };
}
