import { z } from "zod";
import { optionalText, requiredText, uuid } from "./common.ts"; // explicit extension: also loaded by node --test
import { INSTALLATION_TYPES, INSTALLATION_STATUSES } from "./constants.ts";
export { INSTALLATION_TYPES, INSTALLATION_STATUSES } from "./constants.ts";
export type { InstallationType, InstallationStatus } from "./constants.ts";

export const siteSchema = z.object({
  name: requiredText(200),
  address: optionalText(300),
  description: optionalText(5000),
  responsiblePerson: optionalText(200),
});

/** YYYY-MM-DD, not in the future (Tallinn date), not before 1900. */
const pastDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value), "format")
  .refine((value) => value === undefined || value >= "1900-01-01", "range")
  .refine(
    (value) =>
      value === undefined ||
      value <= new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Tallinn" }).format(new Date()),
    "future",
  );

export const installationSchema = z.object({
  siteId: uuid,
  name: requiredText(200),
  identifier: optionalText(50),
  installationType: z.enum(INSTALLATION_TYPES),
  location: optionalText(200),
  description: optionalText(5000),
  commissionedOn: pastDate,
  status: z.enum(INSTALLATION_STATUSES),
  responsiblePerson: optionalText(200),
  notes: optionalText(5000),
});

export function isUuid(value: string): boolean {
  return uuid.safeParse(value).success;
}
