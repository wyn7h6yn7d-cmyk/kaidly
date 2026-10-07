"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { PUBLIC_LINKS } from "./public-nav";
import { SectionLink } from "./section-link";

const ITEM =
  "flex min-h-12 items-center rounded-sm px-3 text-[17px] font-semibold text-k-ink hover:bg-k-ink/5 hover:text-k-green";

/**
 * Public navigation below 1024 px: a disclosure button that opens a panel under the header
 * with the section links and sign-up ("Logi sisse" stays visible in the bar itself). Not a
 * modal, so focus is never trapped. It closes on a chosen link, Escape (focus back on the
 * button) and a click outside it. The header must be `relative`.
 */
export function MobileNav() {
  const t = useT();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Before React is interactive a click could not open anything: disabled until hydrated.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t.common.menu}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={!hydrated}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-k-ink hover:bg-k-ink/5 lg:hidden"
      >
        {open ? <X aria-hidden="true" className="size-6" /> : <Menu aria-hidden="true" className="size-6" />}
      </button>
      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full z-40 border-b border-k-line bg-k-paper lg:hidden"
      >
        <nav aria-label={t.landing.nav.label} className="k-container flex flex-col gap-1 py-3">
          {PUBLIC_LINKS.map((link) => (
            <SectionLink key={link.key} section={link.section} onClick={close} className={ITEM}>
              {t.landing.nav[link.key]}
            </SectionLink>
          ))}
          <Button asChild size="lg" className="mt-2 w-full">
            <Link href="/auth/sign-up" onClick={close}>
              {t.landing.nav.signUp}
            </Link>
          </Button>
        </nav>
      </div>
    </>
  );
}
