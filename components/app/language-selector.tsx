"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { setLocale, syncLocale } from "@/lib/actions/locale";
import { LOCALE_NAMES, LOCALES } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * ET · EN · RU. Switching re-renders in place (router.refresh): the URL, organisation,
 * session and anything typed into forms stay as they are.
 */
export function LanguageSelector({
  tone = "dark",
  compact = false,
  large = false,
  className,
}: {
  tone?: "dark" | "light";
  /** Public pages: slightly larger labels on desktop. */
  large?: boolean;
  /** Below 1024 px: a compact native select instead of three buttons (saves header width). */
  compact?: boolean;
  className?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const choose = (locale: string) =>
    startTransition(async () => {
      if (locale === t.locale) return;
      await setLocale(locale);
      router.refresh();
    });

  const buttons = (
    <div role="group" aria-label={t.common.language} className={cn("flex items-center", compact && "hidden lg:flex", className)}>
      {LOCALES.map((locale) => {
        const active = locale === t.locale;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-label={LOCALE_NAMES[locale]}
            aria-pressed={active}
            disabled={pending}
            onClick={() => choose(locale)}
            className={cn(
              "flex h-11 min-w-11 items-center justify-center rounded-sm px-2 text-sm font-semibold uppercase tracking-wide",
              large && "lg:text-base",
              tone === "light" ? "focus-on-dark" : "",
              active
                ? tone === "light"
                  ? "text-white underline decoration-k-volt decoration-2 underline-offset-[6px]"
                  : "text-k-ink underline decoration-k-green decoration-2 underline-offset-[6px]"
                : tone === "light"
                  ? "text-white/60 hover:text-white"
                  : "text-k-muted hover:text-k-ink",
            )}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
  if (!compact) return buttons;
  return (
    <>
      {buttons}
      <label className="relative flex h-11 shrink-0 items-center lg:hidden">
        <span className="sr-only">{t.common.language}</span>
        <select
          value={t.locale}
          disabled={pending}
          onChange={(event) => choose(event.target.value)}
          className="h-11 appearance-none rounded-sm bg-transparent pl-2 pr-6 text-sm font-semibold uppercase text-k-ink max-[359px]:pl-1 max-[359px]:pr-5"
        >
          {LOCALES.map((locale) => (
            <option key={locale} value={locale} lang={locale} title={LOCALE_NAMES[locale]}>
              {locale.toUpperCase()}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-1 text-xs text-k-muted">
          ▾
        </span>
      </label>
    </>
  );
}

/**
 * Keeps this device in step with the signed-in user's saved language (e.g. after signing
 * in through an email link or on a new device). Renders nothing.
 */
export function LocaleSync({ needed }: { needed: boolean }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (!needed || done.current) return;
    done.current = true;
    void syncLocale().then(({ changed }) => {
      if (changed) router.refresh();
    });
  }, [needed, router]);
  return null;
}
