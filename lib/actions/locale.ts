"use server";

import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

async function writeCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Saves the language for a signed-in user: the profile (RLS: own row, column grant) and the
 * Auth user metadata key `locale`, which the Supabase e-mail templates read to choose
 * ET/EN/RU (docs/EMAIL_TEMPLATES.md). Only et/en/ru ever reach either place.
 */
async function saveForUser(userId: string, locale: Locale, profile: boolean) {
  const supabase = await createClient();
  if (profile) await supabase.from("profiles").update({ preferred_locale: locale }).eq("id", userId);
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.user_metadata?.locale !== locale) await supabase.auth.updateUser({ data: { locale } });
}

/**
 * Switches the UI language: always the cookie; for a signed-in user also their profile
 * (RLS: own row only, column grant: this column only). Routes, organisation and session
 * are untouched; the client refreshes to re-render in the new language.
 */
export async function setLocale(locale: string): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false };
  await writeCookie(locale);
  const user = await getCurrentUser();
  if (user) await saveForUser(user.id, locale, true);
  return { ok: true };
}

/**
 * After sign-in: the profile's language wins on this device; if the user never chose one,
 * the language they picked while signed out is saved to the profile. Returns whether the
 * page needs to re-render.
 */
export async function syncLocale(): Promise<{ changed: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { changed: false };
  const current = await getLocale();
  if (user.preferredLocale) {
    await saveForUser(user.id, user.preferredLocale, false); // e-mail language for older accounts
    if (user.preferredLocale === current) return { changed: false };
    await writeCookie(user.preferredLocale);
    return { changed: true };
  }
  if ((await cookies()).get(LOCALE_COOKIE)) await saveForUser(user.id, current, true);
  return { changed: false };
}
