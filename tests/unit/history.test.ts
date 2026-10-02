import { test } from "node:test";
import assert from "node:assert/strict";
import { describeHistory, historyHref } from "../../lib/history.ts";

test("creation, archive and restore", () => {
  assert.deepEqual(describeHistory({ table: "sites", action: "insert", old: null, new: { name: "Ladu" } }), {
    kind: "created",
    area: "sites",
    name: "Ladu",
  });
  assert.equal(
    describeHistory({ table: "sites", action: "update", old: { name: "Ladu", archived_at: null }, new: { name: "Ladu", archived_at: "2026-10-02" } })?.kind,
    "archived",
  );
  assert.equal(
    describeHistory({ table: "electrical_installations", action: "update", old: { name: "K", archived_at: "x" }, new: { name: "K", archived_at: null } })?.kind,
    "restored",
  );
});

test("only allowlisted fields are named", () => {
  const event = describeHistory({
    table: "sites",
    action: "update",
    old: { name: "A", address: "x", updated_at: "1", created_by: "u1" },
    new: { name: "B", address: "x", updated_at: "2", created_by: "u2" },
  });
  assert.deepEqual(event, { kind: "changed", area: "sites", name: "B", fields: ["name"] });
  // Only internal fields changed: nothing to show.
  assert.equal(
    describeHistory({ table: "sites", action: "update", old: { name: "A", updated_at: "1" }, new: { name: "A", updated_at: "2" } }),
    null,
  );
});

test("deficiency status and activity rescheduling", () => {
  assert.deepEqual(
    describeHistory({ table: "deficiencies", action: "update", old: { title: "T", status: "open" }, new: { title: "T", status: "in_progress" } }),
    { kind: "status", area: "deficiencies", name: "T", from: "open", to: "in_progress" },
  );
  assert.deepEqual(
    describeHistory({ table: "scheduled_activities", action: "update", old: { title: "M", next_due_on: "2026-10-01", anchor_on: "a" }, new: { title: "M", next_due_on: "2027-10-01", anchor_on: "b" } }),
    { kind: "rescheduled", area: "activities", name: "M", from: "2026-10-01", to: "2027-10-01" },
  );
});

test("members and invitations", () => {
  assert.deepEqual(
    describeHistory({ table: "organisation_members", action: "update", old: { user_id: "u", role: "viewer" }, new: { user_id: "u", role: "admin" } }),
    { kind: "roleChanged", area: "members", userId: "u", from: "viewer", to: "admin" },
  );
  assert.equal(describeHistory({ table: "organisation_members", action: "delete", old: { user_id: "u", role: "viewer" }, new: null })?.kind, "memberRemoved");
  assert.equal(
    describeHistory({ table: "organisation_invitations", action: "update", old: { email: "a@b.ee", role: "viewer", revoked_at: null }, new: { email: "a@b.ee", role: "viewer", revoked_at: "x" } })?.kind,
    "invitationRevoked",
  );
});

test("document upload bookkeeping is hidden; finished uploads are shown", () => {
  assert.equal(describeHistory({ table: "documents", action: "insert", old: null, new: { title: "D", status: "pending" } }), null);
  assert.equal(describeHistory({ table: "documents", action: "delete", old: { title: "D", status: "failed" }, new: null }), null);
  assert.equal(
    describeHistory({ table: "documents", action: "update", old: { title: "D", status: "pending" }, new: { title: "D", status: "ready" } })?.kind,
    "uploaded",
  );
});

test("never describes secrets or unknown tables", () => {
  assert.equal(describeHistory({ table: "profiles", action: "update", old: {}, new: {} }), null);
  const event = describeHistory({ table: "organisation_invitations", action: "insert", old: null, new: { email: "a@b.ee", role: "admin", token_hash: "x" } });
  assert.equal(JSON.stringify(event).includes("token"), false);
});

test("links to the record's page", () => {
  assert.equal(historyHref("org", "deficiencies", "id1"), "/o/org/puudused/id1");
  assert.equal(historyHref("org", "organisation_members", "x"), "/o/org/seaded/liikmed");
  assert.equal(historyHref("org", "profiles", "x"), null);
});
