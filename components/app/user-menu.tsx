"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings2, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale } from "@/lib/actions/locale";
import { isLocale, LOCALE_NAMES, LOCALES } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

export function UserMenu({
  name,
  email,
  tone = "dark",
}: {
  name: string | null;
  email: string | null;
  /** light = on the deep green sidebar */
  tone?: "dark" | "light";
}) {
  const t = useT();
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-11 min-w-11 items-center gap-2 rounded-sm px-2 text-left text-[15px] font-medium",
          tone === "light"
            ? "focus-on-dark w-full text-white/90 hover:bg-white/5"
            : "text-k-ink hover:bg-k-ink/5",
        )}
        aria-label={t.common.account}
      >
        <UserRound className="size-5 shrink-0" aria-hidden="true" />
        <span className={cn("truncate", tone === "dark" && "sr-only sm:not-sr-only")}>
          {name ?? email}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-xs text-k-muted">{t.app.signedInAs}</span>
          <span className="block truncate font-semibold">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/konto">
            <Settings2 aria-hidden="true" />
            {t.app.account.title}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-k-muted">{t.common.language}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={t.locale}
          onValueChange={async (value) => {
            if (!isLocale(value) || value === t.locale) return;
            await setLocale(value);
            router.refresh();
          }}
        >
          {LOCALES.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>
              {LOCALE_NAMES[locale]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut aria-hidden="true" />
          {t.common.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
