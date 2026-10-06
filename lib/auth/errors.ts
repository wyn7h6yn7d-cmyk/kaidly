import type { ErrorCode } from "@/lib/i18n";

/**
 * Maps a Supabase Auth error to one of our own error codes. Raw provider messages are
 * never shown to users or put into URLs.
 * Codes: https://supabase.com/docs/guides/auth/debugging/error-codes
 */
export function authErrorCode(error: unknown): ErrorCode {
  if (!error || typeof error !== "object") return "unknown";

  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  const name = "name" in error && typeof error.name === "string" ? error.name : undefined;

  switch (code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "user_banned":
      return "account_disabled";
    case "user_already_exists":
    case "email_exists":
      return "user_already_exists";
    case "weak_password":
      return "weak_password";
    case "same_password":
      return "same_password";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rate_limited";
    case "otp_expired":
      return "link_expired";
    case "reauthentication_not_valid":
      return "reauth_code_invalid";
    case "pkce_code_verifier_not_found":
      return "link_other_browser";
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
    case "bad_jwt":
    case "validation_failed":
      return "link_invalid";
    case "session_not_found":
    case "session_expired":
      return "session_required";
  }

  if (name === "AuthRetryableFetchError" || name === "TypeError") return "network";
  return "unknown";
}
