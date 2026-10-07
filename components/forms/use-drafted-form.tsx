"use client";

import { unstable_rethrow } from "next/navigation";
import { useFormAction } from "@/components/forms/use-form-action";
import { useSessionDraft } from "@/components/forms/use-session-draft";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions/state";
import { useT } from "@/lib/i18n/client";

/**
 * Forms that create or correct a record (log entries, corrections, deficiencies): values
 * survive errors (useFormAction) and unsaved text survives a reload or a lost connection in
 * this tab (useSessionDraft). One implementation for every such form.
 */
export function useDraftedForm(
  action: (state: ActionState, formData: FormData) => Promise<ActionState>,
  /** sessionStorage key for an unsaved draft; null = no draft (e.g. editing). */
  draftKey: string | null = null,
) {
  const draft = useSessionDraft(draftKey);

  const save = async (previous: ActionState, formData: FormData) => {
    // The draft is dropped as the form goes out (a redirect never comes back here) and
    // written again if saving fails, so a lost connection or reload keeps the text.
    draft.clear();
    let result: ActionState;
    try {
      result = await action(previous, formData);
    } catch (error) {
      // A redirect (successful save) arrives as a thrown Next.js signal: let it through
      // without restoring the draft. Only real failures put the text back.
      unstable_rethrow(error);
      draft.saveNow();
      throw error;
    }
    if (!result.ok) draft.saveNow();
    return result;
  };
  const [state, formAction, pending, value] = useFormAction(save);
  return { draft, state, formAction, pending, value };
}

/** "Restored from this tab's draft" notice with a way to start over. */
export function DraftNotice({ onDiscard }: { onDiscard: () => void }) {
  const t = useT();
  return (
    <div role="status" className="flex flex-col gap-2 border-l-4 border-k-green bg-k-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[15px]">{t.app.drafts.restored}</p>
      <Button type="button" variant="ghost" size="sm" onClick={onDiscard} className="self-start sm:self-auto">
        {t.app.drafts.discard}
      </Button>
    </div>
  );
}
