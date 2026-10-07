// External links: photo links (log entries, deficiencies) and document links (Dokumendid).
// KAIDLY stores only the link; the files live wherever the company keeps them. Shared by
// validation and display, and also loaded by node --test, so no path aliases here.

export const MAX_EXTERNAL_URL = 2000;

/**
 * The normalised https URL, null for an empty value, or "invalid". Requires https, a host
 * with a dot and no credentials; mirrors the database checks on `photos_url` / `external_url`.
 */
export function normalizeExternalUrl(raw: string | null | undefined): string | null | "invalid" {
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
  if (href.length > MAX_EXTERNAL_URL) return "invalid";
  if (!/^https:\/\/[^\s/?#@\\]+\.[^\s/?#@\\]+([/?#]\S*)?$/.test(href)) return "invalid";
  return href;
}

/** A short label for a saved link: its host without "www.", e.g. "drive.google.com". */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
