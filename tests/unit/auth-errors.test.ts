import { test } from "node:test";
import assert from "node:assert/strict";
import { authErrorCode } from "../../lib/auth/errors.ts";

test("maps known Supabase auth error codes", () => {
  assert.equal(authErrorCode({ code: "invalid_credentials" }), "invalid_credentials");
  assert.equal(authErrorCode({ code: "otp_expired" }), "link_expired");
  assert.equal(authErrorCode({ code: "flow_state_not_found" }), "link_invalid");
  assert.equal(authErrorCode({ code: "pkce_code_verifier_not_found" }), "link_other_browser");
  assert.equal(authErrorCode({ code: "email_exists" }), "user_already_exists");
  assert.equal(authErrorCode({ code: "over_email_send_rate_limit" }), "rate_limited");
});

test("network failures map to the network message", () => {
  assert.equal(authErrorCode({ name: "AuthRetryableFetchError" }), "network");
});

test("anything else becomes the generic message, never raw provider text", () => {
  assert.equal(authErrorCode({ code: "something_new", message: "<b>raw</b>" }), "unknown");
  assert.equal(authErrorCode(new Error("Database error saving new user")), "unknown");
  assert.equal(authErrorCode(null), "unknown");
  assert.equal(authErrorCode("string error"), "unknown");
});
