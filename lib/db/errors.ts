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
  installation_archived: "installation_archived",
  occurred_in_future: "occurred_in_future",
  correction_target_invalid: "correction_target_invalid",
  log_entries_append_only: "log_entries_append_only",
  activity_archived: "activity_archived",
  activity_already_completed: "activity_already_completed",
  next_due_required: "next_due_required",
  deficiency_resolved: "deficiency_resolved",
  deficiency_already_resolved: "deficiency_already_resolved",
  deficiency_resolve_via_rpc: "deficiency_resolve_via_rpc",
  resolution_required: "resolution_required",
  log_entry_attachment_closed: "log_entry_attachment_closed",
  document_immutable: "document_immutable",
  documents_are_kept: "documents_are_kept",
  organisation_has_history: "organisation_has_history",
  organisation_deactivated: "organisation_deactivated",
  upload_rate_limited: "upload_rate_limited",
  session_required: "session_required",
  confirmation_mismatch: "confirmation_mismatch",
};

export function dbErrorCode(error: unknown): ErrorCode {
  if (!error || typeof error !== "object") return "unknown";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";

  if (Object.hasOwn(RAISED, message)) return RAISED[message];
  if (code === "23505" && message.includes("electrical_installations_site_identifier_key")) {
    return "identifier_taken";
  }
  // "update or delete on table … violates foreign key constraint … on table …": the row
  // has dependent records (e.g. moving an installation that has operating log entries).
  if (code === "23503" && message.startsWith("update or delete on table")) {
    return "has_dependent_records";
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
