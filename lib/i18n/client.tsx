"use client";

import { createContext, use, useContext, useMemo } from "react";
import { et } from "./et";
import { type Messages, type T, withFormat } from "./index";
import type { Locale } from "./locales";

// Estonian (the default) is bundled; English and Russian load on demand, so a visitor
// only downloads the language they use.
const loaders: Record<Exclude<Locale, "et">, () => Promise<Messages>> = {
  en: () => import("./en").then((m) => m.en),
  ru: () => import("./ru").then((m) => m.ru),
};
const pending = new Map<Locale, Promise<Messages>>();

function load(locale: Locale): Promise<Messages> | Messages {
  if (locale === "et") return et;
  let promise = pending.get(locale);
  if (!promise) {
    promise = loaders[locale]();
    pending.set(locale, promise);
  }
  return promise;
}

const I18nContext = createContext<T | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const loaded = load(locale);
  const messages = loaded instanceof Promise ? use(loaded) : loaded;
  const value = useMemo(() => withFormat(locale, messages), [locale, messages]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

/** Messages and formatting for the active language (client components). */
export function useT(): T {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useT() outside I18nProvider");
  return value;
}
