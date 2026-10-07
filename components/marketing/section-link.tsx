"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ComponentProps } from "react";

/** Landing-page sections reachable from the public navigation. */
export const LANDING_SECTIONS = ["kuidas-toimib", "hinnad"] as const;
export type LandingSection = (typeof LANDING_SECTIONS)[number];

/**
 * Scrolls to a section (smoothly unless the user prefers reduced motion) and moves keyboard
 * focus there, so Tab continues from the section and not from the link above it.
 */
function scrollToSection(target: HTMLElement, smooth: boolean) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: smooth && !reduce ? "smooth" : "auto", block: "start" });
  target.focus({ preventScroll: true });
}

/**
 * Link to a landing-page section that keeps the public URL clean (`/`, never `/#hinnad`).
 * On the landing page it scrolls in place without touching the URL or the history; from any
 * other page (or without JavaScript, or opened in a new tab) it is a normal link to `/#…`,
 * which <SectionHashCleanup> then removes from the address bar.
 */
export function SectionLink({ section, onClick, ...props }: { section: LandingSection } & Omit<ComponentProps<typeof Link>, "href">) {
  const pathname = usePathname();
  return (
    <Link
      {...props}
      href={`/#${section}`}
      onClick={(event) => {
        onClick?.(event);
        if (pathname !== "/" || event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = document.getElementById(section);
        if (!target) return;
        event.preventDefault();
        scrollToSection(target, true);
      }}
    />
  );
}

/**
 * Landing page only: an old or shared URL such as `/#hinnad` still lands on its section,
 * then the fragment is removed from the address bar (replaceState — no extra history entry).
 */
export function SectionHashCleanup() {
  useEffect(() => {
    const clean = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!(LANDING_SECTIONS as readonly string[]).includes(id)) return;
      const target = document.getElementById(id);
      if (target) scrollToSection(target, false);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    clean();
    window.addEventListener("hashchange", clean);
    return () => window.removeEventListener("hashchange", clean);
  }, []);
  return null;
}
