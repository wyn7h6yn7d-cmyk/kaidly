import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 10;

/** Passwords are never trimmed or transformed: they go to Supabase Auth exactly as typed. */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, "weak").max(200),
    confirmPassword: z.string().max(200),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "mismatch" })
  .refine((v) => v.newPassword !== v.currentPassword, { message: "same" });

export const emailChangeSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
