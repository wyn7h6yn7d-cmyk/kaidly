// Public site address and indexing policy. KAIDLY_SITE_URL is the canonical production
// origin (e.g. https://kaidly.ee); without it nothing is indexed and canonical URLs fall
// back to the deployment URL. Preview and development are never indexed.

export function siteUrl(): URL {
  const configured = process.env.KAIDLY_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" && url.pathname === "/") return url;
    } catch {
      // fall through
    }
  }
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`);
  return new URL("http://localhost:3000");
}

/** Only the production deployment on the custom domain may be indexed. */
export function isIndexable(): boolean {
  return process.env.VERCEL_ENV === "production" && Boolean(process.env.KAIDLY_SITE_URL?.trim());
}

/** Public pages search engines may list; everything else is the application. */
export const PUBLIC_PAGES = ["/", "/privaatsus", "/kasutustingimused"] as const;
