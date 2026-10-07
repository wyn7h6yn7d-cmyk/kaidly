import { z } from "zod";
import { optionalPhotosUrl, optionalText, requiredText, uuid } from "./common.ts"; // explicit extensions: also loaded by node --test
import { occurredAt } from "./log.ts";
import { SEVERITIES } from "./constants.ts";
export { SEVERITIES, DEFICIENCY_STATUSES } from "./constants.ts";
export type { Severity, DeficiencyStatus } from "./constants.ts";

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
  photosUrl: optionalPhotosUrl,
});

/** Statuses a person may set directly; "resolved" only through resolving. */
export const progressStatusSchema = z.enum(["open", "in_progress"]);
