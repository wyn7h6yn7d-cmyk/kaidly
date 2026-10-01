import { et } from "./et";

/** Same shape as the Estonian dictionary, with literal strings widened to `string`. */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : { readonly [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof et>;

export type ErrorCode = keyof Messages["errors"];

/**
 * The active dictionary. The MVP is Estonian-only; adding English means adding
 * `en.ts` typed as `Messages` and choosing the dictionary here per request.
 */
export const t: Messages = et;

export const locale = "et";

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.hasOwn(t.errors, value);
}
