import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // CLAUDE.md is the single source of agent instructions; don't let `next dev`
  // re-create AGENTS.md or inject its block into CLAUDE.md.
  agentRules: false,
  turbopack: {
    // Pin the workspace root so a stray lockfile in a parent folder isn't picked up.
    root: __dirname,
  },
};

export default nextConfig;
