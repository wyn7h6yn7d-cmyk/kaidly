/**
 * "Soovin jätkata" contact link for an expired company. The address comes only from the
 * KAIDLY_CONTACT_EMAIL server setting (never hard-coded); anything that isn't a plain
 * address — missing, blank, header injection, extra mailto parameters — gives no link.
 */
const PLAIN_ADDRESS = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function contactMailto(address: string | undefined, subject: string): string | null {
  const value = address?.trim();
  if (!value || value.length > 254 || !PLAIN_ADDRESS.test(value)) return null;
  return `mailto:${value}?subject=${encodeURIComponent(subject)}`;
}
