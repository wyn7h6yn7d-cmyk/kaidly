// Build-time guard against mixing environments (docs/DEPLOYMENT.md §1): a Production build
// must use the PRODUCTION Supabase project, a Preview build must not. Refs are public
// project identifiers (they are part of the public API URL), not secrets.

export const SUPABASE_REFS = { development: "gdpzavhkblbcxivoaqax", production: "xakpbtmksxvjmsbipwmj" } as const;

export type GuardResult = { errors: string[]; warnings: string[] };

export function checkDeploymentTarget(env: {
  VERCEL_ENV?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  KAIDLY_SITE_URL?: string;
}): GuardResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const isDev = url.includes(SUPABASE_REFS.development);
  const isProd = url.includes(SUPABASE_REFS.production);
  if (env.VERCEL_ENV === "production") {
    if (isDev) errors.push("Production build is configured with the DEVELOPMENT Supabase project.");
    else if (!isProd) errors.push("Production build is not configured with the PRODUCTION Supabase project (check NEXT_PUBLIC_SUPABASE_URL).");
    if (!env.KAIDLY_SITE_URL?.trim()) warnings.push("KAIDLY_SITE_URL is not set: canonical URLs fall back to the deployment URL and nothing is indexed.");
  } else if (env.VERCEL_ENV === "preview") {
    if (isProd) errors.push("Preview build is configured with the PRODUCTION Supabase project; Preview must use DEVELOPMENT.");
    if (env.KAIDLY_SITE_URL?.trim()) warnings.push("KAIDLY_SITE_URL is set on Preview; it should only be set for Production.");
  } else if (isProd) {
    warnings.push("This local build/dev server talks to the PRODUCTION Supabase project.");
  }
  return { errors, warnings };
}
