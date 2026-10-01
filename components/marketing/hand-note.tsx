import { cn } from "@/lib/utils";

/**
 * Handwritten brand note (DESIGN.md §3). Marketing only, short phrases, at most a couple
 * per page. The arrow is decorative.
 */
export function HandNote({
  children,
  arrow = "down-left",
  className,
}: {
  children: React.ReactNode;
  arrow?: "down-left" | "up-right" | "none";
  className?: string;
}) {
  return (
    <p className={cn("font-hand text-[26px] leading-tight", className)}>
      {arrow === "up-right" && <Arrow className="mb-1 ml-10 rotate-180" />}
      <span className="-rotate-2 inline-block">{children}</span>
      {arrow === "down-left" && <Arrow className="ml-6 mt-1" />}
    </p>
  );
}

function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 40" aria-hidden="true" className={cn("block h-8 w-16", className)}>
      <path
        d="M76 4 C 60 6, 30 10, 10 32"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <path d="M8 18 L 10 33 L 24 30" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
