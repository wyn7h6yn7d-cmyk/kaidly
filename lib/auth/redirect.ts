/**
 * Post-authentication redirects may only go to known internal application paths.
 * Anything else — absolute URLs, protocol-relative URLs, backslashes, query strings,
 * unknown routes — falls back to the default.
 */

export const DEFAULT_AFTER_LOGIN = "/o";

const SEGMENT = "[A-Za-z0-9_-]+";

const ALLOWED_PATHS: RegExp[] = [
  new RegExp(`^/o(/${SEGMENT})*$`), // the application
  /^\/konto$/, // own account
  new RegExp(`^/admin(/${SEGMENT})*$`), // platform administration (404 unless platform admin)
  /^\/auth\/update-password$/, // after a password recovery link
  new RegExp(`^/invite/${SEGMENT}$`), // invitation landing (Phase 2)
];

export function isAllowedRedirectPath(path: string): boolean {
  return ALLOWED_PATHS.some((pattern) => pattern.test(path));
}

/**
 * @param raw  the untrusted value, e.g. a `next` query parameter
 * @param origin  the current request origin; an absolute URL on this same origin is
 *   reduced to its path (Supabase email templates may pass `{{ .RedirectTo }}` as a full URL)
 */
export function safeRedirectPath(raw: string | null | undefined, origin?: string): string {
  if (!raw) return DEFAULT_AFTER_LOGIN;

  let path = raw;
  if (origin && /^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.origin !== origin) return DEFAULT_AFTER_LOGIN;
      if (url.search || url.hash) return DEFAULT_AFTER_LOGIN;
      path = url.pathname;
    } catch {
      return DEFAULT_AFTER_LOGIN;
    }
  }

  if (path.length > 200) return DEFAULT_AFTER_LOGIN;
  return isAllowedRedirectPath(path) ? path : DEFAULT_AFTER_LOGIN;
}
