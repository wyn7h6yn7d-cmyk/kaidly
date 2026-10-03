/**
 * Request path as it may appear in server error logs: no query string, and secrets that
 * live in the path itself (invitation tokens) replaced by a placeholder.
 */
export function safeLogPath(path: string): string {
  return path.split("?")[0].split("#")[0].replace(/^\/invite\/[^/]+/, "/invite/[token]");
}
