import type { NextConfig } from "next";

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
  turbopack: {
    // Pin the workspace root so a stray lockfile in a parent folder isn't picked up.
    root: __dirname,
  },
};

export default nextConfig;
