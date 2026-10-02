import type { Messages } from "@/lib/i18n";

/**
 * Public navigation, shared by header and footer. A future pricing page (docs/PRODUCT.md §7,
 * "Hinnad / Pricing") is one entry here plus its label in t.landing.nav.
 */
export const PUBLIC_LINKS: readonly { key: keyof Omit<Messages["landing"]["nav"], "label">; href: string }[] = [
  { key: "howItWorks", href: "/#kuidas-toimib" },
];
