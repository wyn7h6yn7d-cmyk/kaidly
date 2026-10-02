"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { getOrgContext } from "@/lib/data/organisations";
import { guideHiddenCookie } from "@/lib/onboarding";
import { field } from "@/lib/validation/common";
import type { ActionState } from "./state";

// Only a UI preference for this browser: the checklist is derived from real data and can
// always be reopened from Abi → Alustamise juhend.

async function setHidden(formData: FormData, hidden: boolean): Promise<ActionState> {
  const ctx = await getOrgContext(field(formData, "orgSlug"));
  if (!ctx) return { ok: false, errorCode: "not_found" };
  const store = await cookies();
  if (hidden) store.set(guideHiddenCookie(ctx.org.id), "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  else store.delete(guideHiddenCookie(ctx.org.id));
  refresh();
  return { ok: true };
}

export async function hideGuide(_prev: ActionState, formData: FormData) {
  return setHidden(formData, true);
}

export async function showGuide(_prev: ActionState, formData: FormData) {
  return setHidden(formData, false);
}
