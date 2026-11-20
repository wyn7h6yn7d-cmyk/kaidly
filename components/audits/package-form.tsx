import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getT } from "@/lib/i18n/server";

/** Period (optional) + download. A plain GET form: the PDF route builds the package on request. */
export async function AuditPackageForm({ action }: { action: string }) {
  const t = await getT();
  const p = t.app.auditPackage;
  return (
    <form method="get" action={action} className="flex flex-col gap-4" data-testid="audit-package-form">
      <p className="max-w-3xl text-k-muted">{p.intro}</p>
      <p className="text-sm text-k-muted">{p.periodDefault}</p>
      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          {p.from}
          <Input type="date" name="alates" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          {p.to}
          <Input type="date" name="kuni" />
        </label>
      </div>
      <div>
        <Button type="submit">
          <Download aria-hidden="true" />
          {p.download}
        </Button>
      </div>
    </form>
  );
}
