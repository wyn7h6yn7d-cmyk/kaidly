// Facts about the company behind KAIDLY — ONE place for the public site (footer, pricing
// contact, founder offer, "Meist") and the legal pages (lib/legal/operator.ts reads the
// operator facts from here). Nothing here is invented: unknown values stay null and are
// simply not shown. Also loaded by node --test, so no path aliases here.

export type Testimonial = {
  /** The customer's words exactly as approved by them (not translated). */
  quote: string;
  name: string;
  /** e.g. role and company, as approved by the customer. */
  source: string;
};

export const COMPANY = {
  name: null as string | null, // TÄIDAB KENNETH — legal business name
  registryCode: null as string | null, // TÄIDAB KENNETH — Estonian business registry code
  address: null as string | null, // TÄIDAB KENNETH — registered/contact address
  /** Public contact address (footer, pricing "Võta ühendust", founder offer). */
  email: "info@kaidly.ee",
  /** "Meist" section on the landing page (owner 2026-11-20: shown, without a personal name). */
  showAbout: true,
  /** Real, approved customer quotes only. Empty = the section is not shown. */
  testimonials: [] as Testimonial[],
};

/**
 * The footer line from the filled fields only, e.g.
 * "KAIDLY OÜ, registrikood 12345678, Tallinn". Null when nothing is filled.
 */
export function companyLine(
  company: { name: string | null; registryCode: string | null; address: string | null },
  registryCodeLabel: string,
): string | null {
  const parts = [
    company.name?.trim(),
    company.registryCode?.trim() ? `${registryCodeLabel} ${company.registryCode.trim()}` : null,
    company.address?.trim(),
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(", ") : null;
}

/** "Meist" is shown when switched on (the text names no person — owner decision). */
export const aboutVisible = (company: { showAbout: boolean }) => company.showAbout;
