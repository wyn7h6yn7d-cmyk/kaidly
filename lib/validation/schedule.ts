import { z } from "zod";
import { optionalText, requiredText, uuid } from "./common.ts"; // explicit extension: also loaded by node --test

export const FREQUENCIES = ["once", "recurring"] as const;
export const INTERVAL_UNITS = ["day", "week", "month", "year"] as const;
export const PRIORITIES = ["low", "normal", "high"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];
export type Priority = (typeof PRIORITIES)[number];

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
  })
  .transform((input, ctx) => {
    if (input.frequencyType === "once") {
      return { ...input, intervalValue: null, intervalUnit: null };
    }
    const value = Number.parseInt(input.intervalValue ?? "", 10);
    const unit = INTERVAL_UNITS.find((u) => u === input.intervalUnit);
    if (!Number.isInteger(value) || value < 1 || value > 1000) {
      ctx.addIssue({ code: "custom", path: ["intervalValue"], message: "interval" });
    }
    if (!unit) ctx.addIssue({ code: "custom", path: ["intervalUnit"], message: "interval" });
    return { ...input, intervalValue: value, intervalUnit: unit ?? null };
  });
