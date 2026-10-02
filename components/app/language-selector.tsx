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
export function LanguageSelector({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="group" aria-label={t.common.language} className={cn("flex items-center", className)}>
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
            onClick={() =>
              startTransition(async () => {
                if (active) return;
                await setLocale(locale);
                router.refresh();
              })
            }
            className={cn(
              "flex h-11 min-w-11 items-center justify-center rounded-sm px-2 text-sm font-semibold uppercase tracking-wide",
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
