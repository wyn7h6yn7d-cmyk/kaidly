// Supported UI languages. Estonian is the default; routes never change with the language.

export const LOCALES = ["et", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "et";

/** Remembers the choice for anonymous visitors; signed-in users also store it in their profile. */
export const LOCALE_COOKIE = "kaidly_locale";

/** BCP 47 tags for Intl formatting. Times are always shown in Europe/Tallinn. */
export const INTL_LOCALE: Record<Locale, string> = { et: "et-EE", en: "en-GB", ru: "ru-RU" };

/** Each language's own name, for the language selector. */
export const LOCALE_NAMES: Record<Locale, string> = { et: "Eesti", en: "English", ru: "Русский" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
