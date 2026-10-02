import type { et } from "./et";
import { makeFormat, type Format } from "./format";
import type { Locale } from "./locales";

export { DEFAULT_LOCALE, INTL_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from "./locales";

/** Same shape as the Estonian dictionary, with literal strings widened to `string`. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : { readonly [K in keyof T]: Widen<T[K]> };

/** Every language file must have exactly this shape (missing keys fail the typecheck). */
export type Messages = Widen<typeof et>;

export type ErrorCode = keyof Messages["errors"];

/** The active dictionary plus locale-aware formatting. */
export type T = Messages & { locale: Locale; fmt: Format };

export function withFormat(locale: Locale, messages: Messages): T {
  return { ...messages, locale, fmt: makeFormat(locale) };
}

/** Server code: `await getT()` from "@/lib/i18n/server". Client components: `useT()` from "@/lib/i18n/client". */
export function isErrorCode(value: unknown, messages: Messages): value is ErrorCode {
  return typeof value === "string" && Object.hasOwn(messages.errors, value);
}
