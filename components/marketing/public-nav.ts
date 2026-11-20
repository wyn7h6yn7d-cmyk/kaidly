import type { Messages } from "@/lib/i18n";
import type { LandingSection } from "./section-link";

type NavKey = keyof Omit<Messages["landing"]["nav"], "label" | "trial" | "signUp" | "needs">;
type NavLink = { key: NavKey; section: LandingSection };

/**
 * "Kas mul on vaja?" — the questions visitors come with, grouped under one header item
 * (dropdown on desktop, a labelled group in the mobile menu, plain links in the footer).
 */
export const NEEDS_LINKS: readonly NavLink[] = [
  { key: "whoNeeds", section: "kes-vajab" },
  { key: "audit", section: "audit" },
  { key: "audiences", section: "kellele" },
];

/** Public navigation, shared by header, mobile menu and footer: sections of the landing page. */
export const PUBLIC_LINKS: readonly NavLink[] = [
  { key: "howItWorks", section: "kuidas-toimib" },
  { key: "pricing", section: "hinnad" },
  { key: "about", section: "meist" },
];
