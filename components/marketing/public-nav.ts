import type { Messages } from "@/lib/i18n";

/** Public navigation, shared by header and footer: sections of the landing page. */
export const PUBLIC_LINKS: readonly {
  key: keyof Omit<Messages["landing"]["nav"], "label" | "trial">;
  href: string;
  /** Header breakpoint from which the link is shown (the footer always shows it). */
  from: "sm" | "lg";
}[] = [
  { key: "howItWorks", href: "/#kuidas-toimib", from: "lg" },
  { key: "pricing", href: "/#hinnad", from: "sm" },
];
