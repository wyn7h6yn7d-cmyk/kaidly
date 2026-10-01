import { z } from "zod";
import { ROLES } from "@/lib/auth/roles";
import { optionalText, requiredText, uuid } from "./common";

export const organisationSchema = z.object({
  name: requiredText(200),
  registryCode: optionalText(30),
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
