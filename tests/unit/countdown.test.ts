import { test } from "node:test";
import assert from "node:assert/strict";
import { en } from "../../lib/i18n/en.ts";
import { et } from "../../lib/i18n/et.ts";
import { ru } from "../../lib/i18n/ru.ts";
import { countdown, countdownText, type CountdownMessages } from "../../lib/schedule.ts";
import { todayInTallinn } from "../../lib/time.ts";
import { parseReminderDays } from "../../lib/validation/schedule.ts";

const TODAY = "2026-10-02";
const text = (due: string, m: CountdownMessages) => countdownText(countdown(due, TODAY)!, m);

test("levels: neutral, aware ≤ 30, warning ≤ 14, strong ≤ 7, today, overdue", () => {
  const level = (due: string) => countdown(due, TODAY)!.level;
  assert.equal(level("2026-12-25"), "neutral"); // 84
  assert.equal(level("2026-11-02"), "neutral"); // 31
  assert.equal(level("2026-11-01"), "aware"); // 30
  assert.equal(level("2026-10-17"), "aware"); // 15
  assert.equal(level("2026-10-16"), "warning"); // 14
  assert.equal(level("2026-10-10"), "warning"); // 8
  assert.equal(level("2026-10-09"), "strong"); // 7
  assert.equal(level("2026-10-03"), "strong"); // 1
  assert.equal(level("2026-10-02"), "today");
  assert.equal(level("2026-10-01"), "overdue");
  assert.equal(countdown(null, TODAY), null);
});

test("Estonian wording, singular and plural", () => {
  assert.equal(text("2026-12-25", et.countdown), "84 päeva jäänud");
  assert.equal(text("2026-11-01", et.countdown), "30 päeva jäänud");
  assert.equal(text("2026-10-16", et.countdown), "14 päeva jäänud");
  assert.equal(text("2026-10-09", et.countdown), "7 päeva jäänud");
  assert.equal(text("2026-10-03", et.countdown), "1 päev jäänud");
  assert.equal(text("2026-10-02", et.countdown), "Tähtaeg täna");
  assert.equal(text("2026-10-01", et.countdown), "1 päev üle tähtaja");
  assert.equal(text("2026-09-20", et.countdown), "12 päeva üle tähtaja");
});

test("English wording", () => {
  assert.equal(text("2026-10-03", en.countdown), "1 day left");
  assert.equal(text("2026-10-16", en.countdown), "14 days left");
  assert.equal(text("2026-10-02", en.countdown), "Due today");
  assert.equal(text("2026-10-01", en.countdown), "1 day overdue");
  assert.equal(text("2026-09-20", en.countdown), "12 days overdue");
});

test("Russian wording follows 1 / 2–4 / 5+ (11–14 many, 21 one)", () => {
  assert.equal(text("2026-10-03", ru.countdown), "Остался 1 день");
  assert.equal(text("2026-10-05", ru.countdown), "Осталось 3 дня");
  assert.equal(text("2026-10-09", ru.countdown), "Осталось 7 дней");
  assert.equal(text("2026-10-13", ru.countdown), "Осталось 11 дней");
  assert.equal(text("2026-10-23", ru.countdown), "Остался 21 день");
  assert.equal(text("2026-10-02", ru.countdown), "Срок сегодня");
  assert.equal(text("2026-10-01", ru.countdown), "Просрочено на 1 день");
  assert.equal(text("2026-09-30", ru.countdown), "Просрочено на 2 дня");
  assert.equal(text("2026-09-20", ru.countdown), "Просрочено на 12 дней");
});

test("month and year boundaries count calendar days", () => {
  assert.equal(countdown("2027-01-01", "2026-12-31")!.days, 1);
  assert.equal(countdown("2027-03-01", "2027-02-28")!.days, 1);
  assert.equal(countdown("2028-03-01", "2028-02-28")!.days, 2); // leap year
  assert.equal(countdown("2026-10-26", "2026-10-24")!.days, 2); // across the DST change
});

test("Tallinn midnight decides the business day, not UTC", () => {
  // Summer (UTC+3): 21:00 UTC is midnight in Tallinn.
  assert.equal(todayInTallinn(new Date("2026-10-01T20:59:59Z")), "2026-10-01");
  assert.equal(todayInTallinn(new Date("2026-10-01T21:00:00Z")), "2026-10-02");
  // Winter (UTC+2): 22:00 UTC is midnight.
  assert.equal(todayInTallinn(new Date("2026-12-31T21:59:59Z")), "2026-12-31");
  assert.equal(todayInTallinn(new Date("2026-12-31T22:00:00Z")), "2027-01-01");
  // So an activity due 2026-10-02 reads "Tähtaeg täna" from Tallinn midnight on.
  const due = "2026-10-02";
  assert.equal(countdownText(countdown(due, todayInTallinn(new Date("2026-10-01T20:59:59Z")))!, et.countdown), "1 päev jäänud");
  assert.equal(countdownText(countdown(due, todayInTallinn(new Date("2026-10-01T21:00:00Z")))!, et.countdown), "Tähtaeg täna");
});

test("reminder thresholds: presets plus custom, distinct, 0–365, largest first", () => {
  assert.deepEqual(parseReminderDays(["14", "30", "7", "1"], ""), [30, 14, 7, 1]);
  assert.deepEqual(parseReminderDays(["14"], "14"), [14]);
  assert.deepEqual(parseReminderDays(["7"], " 0 "), [7, 0]);
  assert.deepEqual(parseReminderDays([], undefined), []);
  assert.equal(parseReminderDays(["14"], "366"), null);
  assert.equal(parseReminderDays(["14"], "-1"), null);
  assert.equal(parseReminderDays(["abc"], ""), null);
});

test("reminder summaries in three languages", () => {
  assert.equal(et.app.schedule.reminders.summary([30, 14, 7]), "30, 14 ja 7 päeva enne tähtaega");
  assert.equal(et.app.schedule.reminders.summary([1]), "1 päev enne tähtaega");
  assert.equal(et.app.schedule.reminders.summary([14, 0]), "14 päeva enne tähtaega ja tähtaja päeval");
  assert.equal(en.app.schedule.reminders.summary([14]), "14 days before the due date");
  assert.equal(ru.app.schedule.reminders.summary([30, 14, 7, 1]), "за 30, 14, 7 и 1 день до срока");
  assert.equal(ru.app.schedule.reminders.summary([0]), "в день срока");
});
