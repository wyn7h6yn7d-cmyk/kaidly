import { z } from "zod";
import { localInputToIso } from "../time.ts"; // explicit extensions: also loaded by node --test
import { optionalText, requiredText, uuid } from "./common.ts";
import { LOG_ENTRY_TYPES } from "./constants.ts";
export { LOG_ENTRY_TYPES } from "./constants.ts";
export type { LogEntryType } from "./constants.ts";

/** Tallinn wall-clock "YYYY-MM-DDTHH:mm" → ISO; not in the future (5 min clock skew allowed). */
export const occurredAt = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const iso = localInputToIso(value);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: "time" });
      return z.NEVER;
    }
    if (new Date(iso).getTime() > Date.now() + 5 * 60 * 1000) {
      ctx.addIssue({ code: "custom", message: "future" });
      return z.NEVER;
    }
    return iso;
  });

export const logEntrySchema = z.object({
  installationId: uuid,
  entryType: z.enum(LOG_ENTRY_TYPES),
  occurredAt,
  description: requiredText(5000),
  result: optionalText(2000),
  performedByName: optionalText(200),
});

export const correctionSchema = logEntrySchema.extend({
  correctionOfId: uuid,
  correctionReason: requiredText(1000),
});
