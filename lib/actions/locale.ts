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
 * Switches the UI language: always the cookie; for a signed-in user also their profile
 * (RLS: own row only, column grant: this column only). Routes, organisation and session
 * are untouched; the client refreshes to re-render in the new language.
 */
export async function setLocale(locale: string): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false };
  await writeCookie(locale);
  const user = await getCurrentUser();
  if (user) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ preferred_locale: locale }).eq("id", user.id);
  }
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
  if (user.preferredLocale && user.preferredLocale !== current) {
    await writeCookie(user.preferredLocale);
    return { changed: true };
  }
  if (!user.preferredLocale && (await cookies()).get(LOCALE_COOKIE)) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ preferred_locale: current }).eq("id", user.id);
  }
  return { changed: false };
}
