"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect } from "react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Opens the search page; Ctrl/Cmd+K does the same from anywhere in the app. */
export function SearchButton({ tone = "dark", shortcut = false }: { tone?: "dark" | "light"; shortcut?: boolean }) {
  const t = useT();
  const router = useRouter();
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>("#kaidly-search");
        if (input) input.focus();
        else router.push("/otsing");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, shortcut]);
  return (
    <Link
      href="/otsing"
      aria-label={t.search.open}
      aria-keyshortcuts="Control+K Meta+K"
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-sm",
        tone === "light" ? "focus-on-dark text-white/90 hover:bg-white/5" : "text-k-ink hover:bg-k-ink/5",
      )}
    >
      <Search className="size-5" aria-hidden="true" />
    </Link>
  );
}
