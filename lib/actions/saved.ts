import "server-only";
import { redirect } from "next/navigation";
import { field } from "@/lib/validation/common";
import type { ActionState, SavedRecord } from "./state";

/**
 * Ends a create action: redirects as usual, unless the form still has files to upload —
 * then it returns the new record so the browser can attach them before navigating.
 */
export function savedOrRedirect(formData: FormData, id: string, href: string): ActionState<SavedRecord> {
  if (field(formData, "withAttachments") === "1") return { ok: true, data: { id, href } };
  redirect(href);
}
