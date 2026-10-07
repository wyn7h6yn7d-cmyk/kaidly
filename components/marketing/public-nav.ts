import type { Messages } from "@/lib/i18n";
import type { LandingSection } from "./section-link";

/** Public navigation, shared by header and footer: sections of the landing page. */
export const PUBLIC_LINKS: readonly {
  key: keyof Omit<Messages["landing"]["nav"], "label" | "trial" | "signUp">;
  section: LandingSection;
  /** Header breakpoint from which the link is shown (the footer always shows it). */
  from: "sm" | "lg";
}[] = [
  { key: "howItWorks", section: "kuidas-toimib", from: "lg" },
  { key: "pricing", section: "hinnad", from: "sm" },
];
