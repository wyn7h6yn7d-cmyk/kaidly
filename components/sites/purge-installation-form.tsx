"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteInstallation } from "@/lib/actions/sites";
import { useT } from "@/lib/i18n/client";

/**
 * "Ekspordi ja kustuta": both exports first (audit package PDF with the whole history and the
 * operating-log CSV), then the exact installation name. The database checks the name, the
 * archive state and the role again (delete_installation).
 */
export function PurgeInstallationForm({
  orgSlug,
  installationId,
  name,
  pdfHref,
  csvHref,
}: {
  orgSlug: string;
  installationId: string;
  name: string;
  pdfHref: string;
  csvHref: string;
}) {
  const t = useT();
  const id = useFieldId();
  const p = t.app.installations.purge;
  const [state, action, pending] = useFormAction(deleteInstallation);
  const [pdf, setPdf] = useState(false);
  const [csv, setCsv] = useState(false);
  const [typed, setTyped] = useState("");
  const ready = pdf && csv && typed.trim() === name;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="font-semibold">{p.step1}</p>
        <Button asChild variant={pdf ? "outline" : "default"} className="self-start">
          <a href={pdfHref} download onClick={() => setPdf(true)} data-testid="purge-pdf">
            <Download aria-hidden="true" />
            PDF
          </a>
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-semibold">{p.step2}</p>
        <Button asChild variant={csv ? "outline" : "default"} className="self-start">
          <a href={csvHref} download onClick={() => setCsv(true)} data-testid="purge-csv">
            <Download aria-hidden="true" />
            CSV
          </a>
        </Button>
      </div>
      <form
        action={action}
        className="flex flex-col gap-3 border-t border-k-line pt-6"
        onSubmit={(event) => {
          if (!ready) event.preventDefault();
        }}
      >
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input type="hidden" name="installationId" value={installationId} />
        <label htmlFor={id("confirm")} className="font-semibold">
          {p.step3}: <span className="font-mono">{name}</span>
        </label>
        <Input id={id("confirm")} name="confirmName" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={p.nameLabel} />
        {!(pdf && csv) && <p className="text-sm text-k-muted">{p.downloadFirst}</p>}
        <Button type="submit" variant="destructive" disabled={!ready || pending} className="self-start">
          {pending ? p.submitting : p.submit}
        </Button>
        <FormMessage code={state.errorCode} values={state.errorValues} />
        <p className="text-sm text-k-muted">{p.note}</p>
      </form>
    </div>
  );
}
