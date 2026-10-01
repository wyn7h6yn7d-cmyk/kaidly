import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";

/** Label above, control, optional hint below. One column, as in docs/DESIGN.md §5. */
export function Field({
  id,
  label,
  hint,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="ml-1.5 font-normal text-k-muted">({t.app.optional})</span>}
      </Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-k-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
