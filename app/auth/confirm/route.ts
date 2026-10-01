import { createClient } from "@/lib/supabase/server";
import { authErrorCode } from "@/lib/auth/errors";
import { safeRedirectPath } from "@/lib/auth/redirect";
import type { ErrorCode } from "@/lib/i18n";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

function errorRedirect(code: ErrorCode): never {
  redirect(`/auth/error?code=${code}`);
}

/**
 * Landing point for links in Supabase auth emails (sign-up confirmation, password
 * recovery). Supports both the token-hash template and the default PKCE `code` flow.
 * `next` is only followed if it is a known internal path.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"), origin);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash && isOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) errorRedirect(authErrorCode(error));
    redirect(type === "recovery" ? "/auth/update-password" : next);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) errorRedirect(authErrorCode(error));
    redirect(next);
  }

  errorRedirect("link_invalid");
}
