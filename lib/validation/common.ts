import { z } from "zod";
import { normalizePhotosUrl } from "../photo-links.ts"; // explicit extension: also loaded by node --test

/** Trimmed text; empty string becomes undefined (→ null in the database). */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const uuid = z.uuid();

/** Optional external photo link: trimmed, https only; normalised. Issue message "url". */
export const optionalPhotosUrl = z
  .string()
  .optional()
  .transform((value, ctx) => {
    const url = normalizePhotosUrl(value);
    if (url === "invalid") {
      ctx.addIssue({ code: "custom", message: "url" });
      return z.NEVER;
    }
    return url ?? undefined;
  });

/** Turns zod issues into { field: true } so forms can mark fields as invalid. */
export function fieldErrors(error: z.ZodError): Record<string, true> {
  const fields: Record<string, true> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") fields[key] = true;
  }
  return fields;
}

/** Reads a FormData field as a string ('' when absent). */
export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
