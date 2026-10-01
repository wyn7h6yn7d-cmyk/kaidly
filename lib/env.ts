/**
 * Required runtime configuration. Fails closed: if anything is missing or still the
 * placeholder from .env.example, every Supabase client and the proxy refuse to run
 * instead of silently skipping authentication.
 *
 * `process.env.NEXT_PUBLIC_*` must be accessed with literal property names so Next.js
 * can inline them into the browser bundle.
 */

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

const PLACEHOLDERS = new Set(["your-project-url", "your-publishable-or-anon-key"]);

function readSupabaseEnv(): { env: SupabaseEnv | null; problems: string[] } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const problems: string[] = [];

  if (!url || PLACEHOLDERS.has(url)) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL is not set");
  } else {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
        problems.push("NEXT_PUBLIC_SUPABASE_URL must use https");
      }
      if (parsed.pathname !== "/" && parsed.pathname !== "") {
        problems.push("NEXT_PUBLIC_SUPABASE_URL must be the project URL without a path (e.g. no /rest/v1)");
      }
    } catch {
      problems.push("NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
    }
  }

  if (!publishableKey || PLACEHOLDERS.has(publishableKey)) {
    problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  }

  if (problems.length > 0) {
    return { env: null, problems };
  }
  return { env: { url: url!, publishableKey: publishableKey! }, problems };
}

/** Returns the Supabase configuration or throws a ConfigurationError. */
export function getSupabaseEnv(): SupabaseEnv {
  const { env, problems } = readSupabaseEnv();
  if (!env) {
    throw new ConfigurationError(
      `KAIDLY is not configured: ${problems.join("; ")}. ` +
        "Copy .env.example to .env.local and fill in the Supabase project values.",
    );
  }
  return env;
}
