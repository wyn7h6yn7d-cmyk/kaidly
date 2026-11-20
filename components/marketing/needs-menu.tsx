"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { NEEDS_LINKS } from "./public-nav";
import { SectionLink } from "./section-link";

/**
 * "Kas mul on vaja?" in the desktop header: a disclosure button with three section links
 * (the questions visitors come with). Not a modal and not an ARIA menu — plain links, so Tab
 * works as everywhere else. Closes on a chosen link, Escape (focus back on the button), a
 * click outside it and when focus leaves it.
 */
export function NeedsMenu({ className }: { className?: string }) {
  const t = useT();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn("relative", className)}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 items-center gap-1 whitespace-nowrap rounded-sm px-2.5 text-[16px] font-semibold text-k-ink hover:text-k-green xl:px-4 xl:text-[17px]"
      >
        {t.landing.nav.needs}
        <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute left-0 top-full z-50 mt-2 min-w-[18rem] border border-k-ink/70 bg-k-paper py-2 shadow-[0_2px_10px_rgba(17,24,39,0.08)]"
      >
        <ul>
          {NEEDS_LINKS.map((link) => (
            <li key={link.key}>
              <SectionLink
                section={link.section}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center whitespace-nowrap px-4 text-[16px] font-semibold text-k-ink hover:bg-k-ink/5 hover:text-k-green"
              >
                {t.landing.nav[link.key]}
              </SectionLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
