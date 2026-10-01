import { test } from "node:test";
import assert from "node:assert/strict";
import { dbErrorCode } from "../../lib/db/errors.ts";

test("RPC error codes map to their own messages", () => {
  assert.equal(dbErrorCode({ code: "P0001", message: "last_owner" }), "last_owner");
  assert.equal(dbErrorCode({ code: "P0001", message: "invitation_used" }), "invitation_used");
  assert.equal(dbErrorCode({ code: "42501", message: "forbidden" }), "forbidden");
  assert.equal(dbErrorCode({ code: "P0001", message: "site_archived" }), "site_archived");
});

test("SQLSTATEs map to generic codes", () => {
  assert.equal(dbErrorCode({ code: "42501", message: "new row violates row-level security policy" }), "forbidden");
  assert.equal(dbErrorCode({ code: "23514", message: "check" }), "invalid_input");
  assert.equal(dbErrorCode({ code: "23503", message: "fk" }), "not_found");
  assert.equal(dbErrorCode({ code: "22P02", message: "invalid input syntax for type uuid" }), "not_found");
});

test("database text never passes through", () => {
  assert.equal(dbErrorCode({ code: "XX000", message: "relation secret_table does not exist" }), "unknown");
  assert.equal(dbErrorCode({ message: "hasOwnProperty" }), "unknown");
  assert.equal(dbErrorCode(null), "unknown");
});
