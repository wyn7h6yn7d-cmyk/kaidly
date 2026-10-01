import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, dueState, dueStateRange } from "../../lib/schedule.ts";

const today = "2026-10-01";

test("derived due states", () => {
  assert.equal(dueState(null, today), "done");
  assert.equal(dueState("2026-09-30", today), "overdue");
  assert.equal(dueState("2026-10-01", today), "soon");
  assert.equal(dueState("2026-10-15", today), "soon");
  assert.equal(dueState("2026-10-16", today), "upcoming");
});

test("date arithmetic across month and year ends", () => {
  assert.equal(addDays("2026-12-25", 14), "2027-01-08");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(daysBetween("2026-09-01", "2026-10-01"), 30);
  assert.equal(daysBetween("2026-10-01", "2026-09-28"), -3);
});

test("filter ranges line up with the states", () => {
  assert.deepEqual(dueStateRange("overdue", today), { before: "2026-10-01" });
  assert.deepEqual(dueStateRange("soon", today), { from: "2026-10-01", to: "2026-10-15" });
  assert.deepEqual(dueStateRange("upcoming", today), { after: "2026-10-15" });
  assert.deepEqual(dueStateRange("done", today), { done: true });
});
