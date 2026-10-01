import { z } from "zod";
import { optionalText, requiredText, uuid } from "./common.ts"; // explicit extensions: also loaded by node --test
import { occurredAt } from "./log.ts";

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const DEFICIENCY_STATUSES = ["open", "in_progress", "resolved"] as const;
export type Severity = (typeof SEVERITIES)[number];
export type DeficiencyStatus = (typeof DEFICIENCY_STATUSES)[number];

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value), "date");

export const deficiencySchema = z.object({
  installationId: uuid,
  title: requiredText(200),
  description: requiredText(5000),
  severity: z.enum(SEVERITIES),
  detectedAt: occurredAt,
  responsiblePersonName: optionalText(200),
  dueOn: optionalDate,
});

/** Statuses a person may set directly; "resolved" only through resolving. */
export const progressStatusSchema = z.enum(["open", "in_progress"]);
