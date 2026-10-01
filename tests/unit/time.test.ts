import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateTime, localInputToIso, toLocalInput, todayInTallinn } from "../../lib/time.ts";

test("winter time: Tallinn is UTC+2", () => {
  assert.equal(localInputToIso("2026-01-15T10:30"), "2026-01-15T08:30:00.000Z");
});

test("summer time: Tallinn is UTC+3", () => {
  assert.equal(localInputToIso("2026-07-15T10:30"), "2026-07-15T07:30:00.000Z");
});

test("round trip through the datetime-local format", () => {
  const instant = new Date("2026-10-01T12:34:00.000Z");
  assert.equal(toLocalInput(instant), "2026-10-01T15:34");
  assert.equal(localInputToIso(toLocalInput(instant)), instant.toISOString());
});

test("malformed or impossible input is rejected", () => {
  assert.equal(localInputToIso("2026-02-30T10:00"), null);
  assert.equal(localInputToIso("15.01.2026 10:30"), null);
  assert.equal(localInputToIso("2026-01-15T25:00"), null);
  assert.equal(localInputToIso(""), null);
});

test("Estonian display format and Tallinn 'today'", () => {
  assert.equal(formatDateTime("2026-03-12T12:05:00.000Z"), "12.03.2026 14:05");
  assert.equal(todayInTallinn(new Date("2026-12-31T22:30:00.000Z")), "2027-01-01");
});
