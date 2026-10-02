import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ConfigurationError, getSupabaseEnv } from "@/lib/env";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/redirect";
import { LAST_ORG_COOKIE } from "@/lib/org-cookie";
import { en } from "@/lib/i18n/en";
import { et } from "@/lib/i18n/et";
import { ru } from "@/lib/i18n/ru";

/** Routes reachable without a session. Everything else requires sign-in. */
const PUBLIC_PATHS = new Set([
  "/",
  "/auth/login",
  "/auth/sign-up",
  "/auth/sign-up-success",
  "/auth/forgot-password",
  "/auth/confirm",
  "/auth/error",
]);

/** Public routes a signed-in user has no reason to see. */
const SIGNED_IN_REDIRECT_PATHS = new Set(["/auth/login", "/auth/sign-up"]);

function configurationErrorResponse(error: ConfigurationError) {
  // Never continue without configuration: fail closed.
  console.error(error.message);
  const body =
    process.env.NODE_ENV === "production"
      ? [et, en, ru].map((m) => `${m.config.title}. ${m.config.body}`).join("\n\n")
      : `${error.message}\n\nRestart \`npm run dev\` after changing .env.local.`;
  return new NextResponse(body, {
    status: 500,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

/**
 * Refreshes the Supabase session cookie and redirects anonymous users to login.
 * This is an optimistic check only — authorisation is enforced by RLS in the database
 * and by server-side checks in pages and actions.
 */
export async function updateSession(request: NextRequest) {
  let env;
  try {
    env = getSupabaseEnv();
  } catch (error) {
    if (error instanceof ConfigurationError) return configurationErrorResponse(error);
    throw error;
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): getClaims() refreshes
  // the session, and anything in between can cause users to be logged out at random.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (!signedIn && !PUBLIC_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    // The login page validates `next` against the allowlist before using it.
    url.searchParams.set("next", pathname);
    return redirectWithCookies(url, supabaseResponse);
  }

  if (signedIn && SIGNED_IN_REDIRECT_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_AFTER_LOGIN;
    url.search = "";
    return redirectWithCookies(url, supabaseResponse);
  }

  // Remember the last opened organisation (a slug only; access is still checked on
  // every request) so /o can return the user there.
  const orgMatch = /^\/o\/([a-z0-9]+(?:-[a-z0-9]+)+)(?:\/|$)/.exec(pathname);
  if (signedIn && orgMatch) {
    supabaseResponse.cookies.set(LAST_ORG_COOKIE, orgMatch[1], {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // Return supabaseResponse as is: it carries the refreshed session cookies.
  return supabaseResponse;
}

function redirectWithCookies(url: URL, from: NextResponse) {
  const response = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}
