"use client";

import { useState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deactivateOrganisation, deleteOrganisation } from "@/lib/actions/organisation-lifecycle";
import { useT } from "@/lib/i18n/client";

/**
 * Deliberate confirmation: the owner types the organisation's exact name. The button stays
 * disabled until it matches; the database checks the same name again.
 */
export function LifecycleForm({
  mode,
  organisationId,
  orgSlug,
  name,
}: {
  mode: "delete" | "deactivate";
  organisationId: string;
  orgSlug: string;
  name: string;
}) {
  const t = useT();
  const l = t.app.lifecycle;
  const [state, action, pending] = useFormAction(mode === "delete" ? deleteOrganisation : deactivateOrganisation);
  const [typed, setTyped] = useState("");
  const id = useFieldId();
  const matches = typed.trim() === name;
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <input type="hidden" name="organisationId" value={organisationId} />
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <Field id={id("confirmName")} label={l.confirmLabel(name)}>
        <Input
          id={id("confirmName")}
          name="confirmName"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          aria-invalid={state.fields?.confirmName}
        />
      </Field>
      <FormMessage code={state.errorCode} />
      <div>
        <Button type="submit" variant="destructive" size="lg" disabled={!matches || pending}>
          {pending ? l.working : mode === "delete" ? l.deleteSubmit : l.deactivateSubmit}
        </Button>
      </div>
    </form>
  );
}
