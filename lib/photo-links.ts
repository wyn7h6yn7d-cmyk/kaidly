// External photo links (log entries and deficiencies). KAIDLY stores only the link; the
// photos live wherever the company keeps them. Shared by validation and display, and also
// loaded by node --test, so no path aliases here.

export const MAX_PHOTOS_URL = 2000;

/**
 * The normalised https URL, null for an empty value, or "invalid". Requires https, a host
 * with a dot and no credentials; mirrors the database check on `photos_url`.
 */
export function normalizePhotosUrl(raw: string | null | undefined): string | null | "invalid" {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (!/^https:\/\//i.test(value) || /\s/.test(value)) return "invalid";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "invalid";
  }
  if (url.protocol !== "https:" || url.username || url.password) return "invalid";
  if (!url.hostname.includes(".") || url.hostname.startsWith(".") || url.hostname.endsWith(".")) return "invalid";
  const href = url.href;
  if (href.length > MAX_PHOTOS_URL) return "invalid";
  if (!/^https:\/\/[^\s/?#@\\]+\.[^\s/?#@\\]+([/?#]\S*)?$/.test(href)) return "invalid";
  return href;
}

/** A short label for a saved link: its host without "www.", e.g. "drive.google.com". */
export function photosLinkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
