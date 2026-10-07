import type { Messages } from "@/lib/i18n";
import type { LandingSection } from "./section-link";

/** Public navigation, shared by header, mobile menu and footer: sections of the landing page. */
export const PUBLIC_LINKS: readonly {
  key: keyof Omit<Messages["landing"]["nav"], "label" | "trial" | "signUp">;
  section: LandingSection;
}[] = [
  { key: "howItWorks", section: "kuidas-toimib" },
  { key: "pricing", section: "hinnad" },
];
