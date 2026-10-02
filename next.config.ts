import type { NextConfig } from "next";
import { checkDeploymentTarget } from "./lib/env-guard";

// Never build Production against Development (or Preview against Production).
const guard = checkDeploymentTarget({
  VERCEL_ENV: process.env.VERCEL_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  KAIDLY_SITE_URL: process.env.KAIDLY_SITE_URL,
});
for (const warning of guard.warnings) console.warn(`[kaidly] ${warning}`);
if (guard.errors.length) throw new Error(`[kaidly] ${guard.errors.join(" ")}`);

// Security headers (docs/DEPLOYMENT.md). The CSP allows only this origin and the project's
// Supabase API. 'unsafe-inline' for scripts is required by the App Router's inline
// bootstrap/RSC scripts and the tiny <html lang> script without per-request nonces (which
// would force every page dynamic); everything else is locked down: no third-party
// scripts, no framing, no plugins, no foreign form targets.
const supabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const dev = process.env.NODE_ENV === "development";
// Vercel's toolbar on Preview deployments only (it is not part of KAIDLY).
const toolbar = process.env.VERCEL_ENV === "preview" ? "https://vercel.live" : "";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} ${toolbar}`,
  `style-src 'self' 'unsafe-inline' ${toolbar}`,
  `img-src 'self' data: blob: ${supabase} ${toolbar ? "https://vercel.live https://vercel.com" : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${supabase.replace(/^http/, "ws")}${dev ? " ws: http://127.0.0.1:* http://localhost:*" : ""} ${toolbar ? "https://vercel.live wss://ws-us3.pusher.com" : ""}`,
  `frame-src ${toolbar || "'none'"}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
]
  .map((d) => d.replace(/\s+/g, " ").trim())
  .join("; ");
const indexable = process.env.VERCEL_ENV === "production" && Boolean(process.env.KAIDLY_SITE_URL?.trim());

const nextConfig: NextConfig = {
  cacheComponents: true,
  // CLAUDE.md is the single source of agent instructions; don't let `next dev`
  // re-create AGENTS.md or inject its block into CLAUDE.md.
  agentRules: false,
  // The floating dev indicator sits over the sidebar's account menu (bottom-left) and
  // intercepts clicks; build/route insights are still printed in the terminal.
  devIndicators: false,
  // Report PDFs (app/o/[org]/aruanded/…/eksport): pdfmake/pdfkit read fonts and font
  // metrics from disk at runtime, so they stay external and their files ship with the route.
  serverExternalPackages: ["pdfmake", "pdfkit"],
  outputFileTracingIncludes: {
    "/o/[org]/aruanded/[report]/eksport": ["./node_modules/pdfmake/fonts/Roboto/**", "./node_modules/pdfkit/js/data/**"],
  },
  poweredByHeader: false,
  async headers() {
    const security = [
      { key: "Content-Security-Policy", value: csp },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
    ];
    const noindex = { key: "X-Robots-Tag", value: "noindex, nofollow" };
    return [
      { source: "/:path*", headers: indexable ? security : [...security, noindex] },
      // The application is never indexed, even in production.
      ...["/o/:path*", "/admin/:path*", "/konto", "/auth/:path*", "/invite/:path*", "/otsing", "/teavitused/:path*", "/teavitused", "/admin", "/o", "/api/:path*"].map(
        (source) => ({ source, headers: [noindex] }),
      ),
    ];
  },
  turbopack: {
    // Pin the workspace root so a stray lockfile in a parent folder isn't picked up.
    root: __dirname,
  },
};

export default nextConfig;
