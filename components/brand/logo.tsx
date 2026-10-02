/**
 * PROVISIONAL LOGO — development placeholder only (decision D19).
 * A simplified bolt mark + typeset wordmark inspired by design/KAIDLY-brand-board.png.
 * Replace with the production SVG assets when they exist; don't refine this one.
 */
import { cn } from "@/lib/utils";

const BOLT_PATH = "M20 2 L7 18 H15 L11 30 L25 13 H17 L22 2 Z";

export function LogoMark({
  className,
  color = "volt",
}: {
  className?: string;
  /** volt on dark or brand surfaces; green on paper, where volt is too faint */
  color?: "volt" | "green";
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("h-7 w-7", color === "volt" ? "text-k-volt" : "text-k-green", className)}
      data-provisional-logo
    >
      <path d={BOLT_PATH} fill="currentColor" />
    </svg>
  );
}

export function Logo({
  className,
  tone = "dark",
  large = false,
}: {
  className?: string;
  /** Public header: a step up from desktop widths. */
  large?: boolean;
  /** dark = ink wordmark for light backgrounds; light = white wordmark for dark backgrounds */
  tone?: "dark" | "light";
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      aria-label="KAIDLY"
      role="img"
    >
      <LogoMark className={large ? "lg:h-8 lg:w-8" : undefined} />
      <span
        aria-hidden="true"
        className={cn(
          "font-display text-[22px] font-extrabold leading-none tracking-[-0.01em]",
          large && "lg:text-[26px]",
          tone === "light" ? "text-white" : "text-k-ink",
        )}
      >
        KAIDLY
      </span>
    </span>
  );
}
