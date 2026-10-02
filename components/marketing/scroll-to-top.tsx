"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * "Back to top" for long public pages: appears after roughly one viewport of scrolling,
 * stays clear of the footer (lifts above it when the footer is in view), scrolls smoothly
 * unless the user prefers reduced motion, then moves keyboard focus to the top of the page.
 */
export function ScrollToTop() {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(window.scrollY > Math.max(700, window.innerHeight));
      const footer = document.querySelector("footer");
      setLift(footer ? Math.max(0, window.innerHeight - footer.getBoundingClientRect().top) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    // Keyboard users continue from the top, not from a button that disappears.
    document.querySelector<HTMLElement>("header a")?.focus({ preventScroll: true });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label={t.common.backToTop}
      title={t.common.backToTop}
      data-testid="scroll-to-top"
      style={{ bottom: `calc(${lift}px + max(1rem, env(safe-area-inset-bottom)) + 0.5rem)` }}
      className={cn(
        "fixed right-4 z-30 inline-flex size-12 items-center justify-center rounded-full border border-k-ink/15 bg-k-surface text-k-ink shadow-[0_2px_10px_rgba(17,24,39,0.12)] transition-opacity duration-200 hover:bg-k-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-k-green focus-visible:ring-offset-2 motion-reduce:transition-none sm:right-6",
        visible ? "opacity-100" : "pointer-events-none invisible opacity-0",
      )}
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </button>
  );
}
