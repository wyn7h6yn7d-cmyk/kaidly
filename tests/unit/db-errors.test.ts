import { test } from "node:test";
import assert from "node:assert/strict";
import { dbErrorCode } from "../../lib/db/errors.ts";

test("RPC error codes map to their own messages", () => {
  assert.equal(dbErrorCode({ code: "P0001", message: "last_owner" }), "last_owner");
  assert.equal(dbErrorCode({ code: "P0001", message: "invitation_used" }), "invitation_used");
  assert.equal(dbErrorCode({ code: "42501", message: "forbidden" }), "forbidden");
  assert.equal(dbErrorCode({ code: "P0001", message: "site_archived" }), "site_archived");
});

test("upload abuse limits get their own message", () => {
  assert.equal(dbErrorCode({ code: "P0001", message: "upload_rate_limited" }), "upload_rate_limited");
  assert.equal(dbErrorCode({ code: "42501", message: "session_required" }), "session_required");
});

test("SQLSTATEs map to generic codes", () => {
  assert.equal(dbErrorCode({ code: "42501", message: "new row violates row-level security policy" }), "forbidden");
  assert.equal(dbErrorCode({ code: "23514", message: "check" }), "invalid_input");
  assert.equal(dbErrorCode({ code: "23503", message: "fk" }), "not_found");
  assert.equal(dbErrorCode({ code: "22P02", message: "invalid input syntax for type uuid" }), "not_found");
});

test("a duplicate installation identifier gets its own message", () => {
  assert.equal(
    dbErrorCode({
      code: "23505",
      message: 'duplicate key value violates unique constraint "electrical_installations_site_identifier_key"',
    }),
    "identifier_taken",
  );
  assert.equal(dbErrorCode({ code: "23505", message: "duplicate key" }), "duplicate");
});

test("database text never passes through", () => {
  assert.equal(dbErrorCode({ code: "XX000", message: "relation secret_table does not exist" }), "unknown");
  assert.equal(dbErrorCode({ message: "hasOwnProperty" }), "unknown");
  assert.equal(dbErrorCode(null), "unknown");
});
