import { z } from "zod";
import { ROLES } from "../auth/roles.ts"; // explicit extensions: also loaded by node --test
import { optionalText, requiredText, uuid } from "./common.ts";

export const organisationSchema = z.object({
  name: requiredText(200),
  registryCode: optionalText(30),
});

/** Company details editable by owners and admins. The slug is never part of this. */
export const organisationSettingsSchema = organisationSchema.extend({
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .optional()
    .transform((value) => (value ? value : undefined))
    .pipe(z.email().optional()),
  contactPhone: optionalText(40),
  address: optionalText(300),
  notes: optionalText(2000),
});

export const invitationSchema = z.object({
  organisationId: uuid,
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  role: z.enum(ROLES),
});

export const memberRoleSchema = z.object({
  memberId: uuid,
  role: z.enum(ROLES),
});

export const memberIdSchema = z.object({ memberId: uuid });

export const invitationIdSchema = z.object({ invitationId: uuid });

export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const profileSchema = z.object({
  fullName: requiredText(200),
  phone: optionalText(40),
});
