import { z } from "zod";
import { optionalText, requiredText, uuid } from "./common.ts"; // explicit extension: also loaded by node --test

export const FREQUENCIES = ["once", "recurring"] as const;
export const INTERVAL_UNITS = ["day", "week", "month", "year"] as const;
export const PRIORITIES = ["low", "normal", "high"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];
export type Priority = (typeof PRIORITIES)[number];

/** Reminder thresholds offered as checkboxes; any other 0–365 can be added as "custom". */
export const REMINDER_PRESETS = [30, 14, 7, 1] as const;
export const DEFAULT_REMINDER_DAYS = [14];

/** Checked presets plus an optional custom value → distinct days, largest first. */
export function parseReminderDays(checked: string[], custom: string | undefined): number[] | null {
  const values = [...checked, ...(custom?.trim() ? [custom.trim()] : [])];
  const days: number[] = [];
  for (const value of values) {
    if (!/^\d{1,3}$/.test(value)) return null;
    const n = Number(value);
    if (n > 365) return null;
    if (!days.includes(n)) days.push(n);
  }
  if (days.length > 8) return null;
  return days.sort((a, b) => b - a);
}

const date = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => value >= "1900-01-01" && value <= "2200-12-31");

/**
 * Activity master data. For one-time activities interval fields are ignored; for
 * recurring ones both are required.
 */
export const activitySchema = z
  .object({
    installationId: uuid,
    title: requiredText(200),
    description: optionalText(5000),
    frequencyType: z.enum(FREQUENCIES),
    intervalValue: z.string().trim().optional(),
    intervalUnit: z.string().trim().optional(),
    nextDueOn: date,
    responsiblePersonName: optionalText(200),
    priority: z.enum(PRIORITIES),
    reminderDays: z.array(z.string()).default([]),
    reminderCustom: z.string().optional(),
  })
  .transform((input, ctx) => {
    const reminderDays = parseReminderDays(input.reminderDays, input.reminderCustom);
    if (!reminderDays) ctx.addIssue({ code: "custom", path: ["reminderCustom"], message: "reminders" });
    if (input.frequencyType === "once") {
      return { ...input, reminderDays: reminderDays ?? [], intervalValue: null, intervalUnit: null };
    }
    const value = Number.parseInt(input.intervalValue ?? "", 10);
    const unit = INTERVAL_UNITS.find((u) => u === input.intervalUnit);
    if (!Number.isInteger(value) || value < 1 || value > 1000) {
      ctx.addIssue({ code: "custom", path: ["intervalValue"], message: "interval" });
    }
    if (!unit) ctx.addIssue({ code: "custom", path: ["intervalUnit"], message: "interval" });
    return { ...input, reminderDays: reminderDays ?? [], intervalValue: value, intervalUnit: unit ?? null };
  });
