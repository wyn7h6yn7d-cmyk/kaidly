import type { ErrorCode } from "@/lib/i18n";

/**
 * Maps a PostgREST / Postgres error to one of our error codes. Database messages are
 * never shown to users. RPCs raise short machine codes as the message (see the
 * migrations), which are mapped here; everything else maps by SQLSTATE.
 */
const RAISED: Record<string, ErrorCode> = {
  forbidden: "forbidden",
  not_authenticated: "session_required",
  not_found: "not_found",
  last_owner: "last_owner",
  already_member: "already_member",
  email_not_confirmed: "email_not_confirmed",
  invitation_invalid: "invitation_invalid",
  invitation_expired: "invitation_expired",
  invitation_used: "invitation_used",
  invitation_revoked: "invitation_revoked",
  invitation_email_mismatch: "invitation_email_mismatch",
  invitation_already_member: "invitation_already_member",
  site_archived: "site_archived",
};

export function dbErrorCode(error: unknown): ErrorCode {
  if (!error || typeof error !== "object") return "unknown";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";

  if (Object.hasOwn(RAISED, message)) return RAISED[message];
  if (code === "23505" && message.includes("electrical_installations_site_identifier_key")) {
    return "identifier_taken";
  }

  switch (code) {
    case "42501": // insufficient_privilege, incl. RLS "new row violates row-level security policy"
      return "forbidden";
    case "23514": // check_violation
    case "23502": // not_null_violation
    case "22001": // string_data_right_truncation
    case "22007": // invalid_datetime_format
    case "22008": // datetime_field_overflow
      return "invalid_input";
    case "23505": // unique_violation
      return "duplicate";
    case "23503": // foreign_key_violation — e.g. a site from another organisation
    case "22P02": // invalid_text_representation — e.g. a malformed uuid
    case "PGRST116": // no rows for .single()
      return "not_found";
  }
  return "unknown";
}
