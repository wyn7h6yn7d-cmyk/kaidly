import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { en } from "./en";
import { et } from "./et";
import { type Messages, type T, withFormat } from "./index";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locales";
import { ru } from "./ru";

const DICTIONARIES: Record<Locale, Messages> = { et, en, ru };

/**
 * The request's language: the `kaidly_locale` cookie (set by the language selector and,
 * for signed-in users, kept in step with their profile), else Estonian.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

/** Messages and formatting for the request's language. Server Components, actions, routes. */
export const getT = cache(async (): Promise<T> => {
  const locale = await getLocale();
  return withFormat(locale, DICTIONARIES[locale]);
});

export function messagesFor(locale: Locale): T {
  return withFormat(locale, DICTIONARIES[locale]);
}

/**
 * Whether a signed-in user's device must be brought in step with their profile: their
 * saved language differs from this request's, or they never saved one but chose one here.
 */
export async function localeSyncNeeded(preferredLocale: Locale | null): Promise<boolean> {
  if (preferredLocale) return preferredLocale !== (await getLocale());
  return Boolean((await cookies()).get(LOCALE_COOKIE));
}
