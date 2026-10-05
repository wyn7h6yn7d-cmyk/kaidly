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

test("Tallinn business date across daylight-saving changes, midnight and the year end", () => {
  // Autumn: EEST (+3) → EET (+2) on 2026-10-25 at 04:00 local (01:00 UTC).
  assert.equal(todayInTallinn(new Date("2026-10-24T20:59:00Z")), "2026-10-24"); // 23:59 EEST
  assert.equal(todayInTallinn(new Date("2026-10-24T21:00:00Z")), "2026-10-25"); // 00:00 EEST
  assert.equal(todayInTallinn(new Date("2026-10-25T21:59:00Z")), "2026-10-25"); // 23:59 EET
  assert.equal(todayInTallinn(new Date("2026-10-25T22:00:00Z")), "2026-10-26"); // 00:00 EET
  // Spring: EET (+2) → EEST (+3) on 2027-03-28 at 03:00 local (01:00 UTC).
  assert.equal(todayInTallinn(new Date("2027-03-27T21:59:00Z")), "2027-03-27");
  assert.equal(todayInTallinn(new Date("2027-03-27T22:00:00Z")), "2027-03-28");
  assert.equal(todayInTallinn(new Date("2027-03-28T20:59:00Z")), "2027-03-28");
  assert.equal(todayInTallinn(new Date("2027-03-28T21:00:00Z")), "2027-03-29");
  // Year end (EET).
  assert.equal(todayInTallinn(new Date("2026-12-31T21:59:00Z")), "2026-12-31");
  assert.equal(todayInTallinn(new Date("2026-12-31T22:00:00Z")), "2027-01-01");
});

test("local wall-clock input converts with the offset of that day", () => {
  assert.equal(localInputToIso("2026-10-24T12:00"), "2026-10-24T09:00:00.000Z"); // EEST
  assert.equal(localInputToIso("2026-10-26T12:00"), "2026-10-26T10:00:00.000Z"); // EET
  assert.equal(localInputToIso("2027-03-29T12:00"), "2027-03-29T09:00:00.000Z"); // EEST again
});
