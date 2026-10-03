import { CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuthHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
      {description && <p className="mt-2 text-k-muted">{description}</p>}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex gap-2 rounded-sm border-l-4 border-k-danger bg-k-paper-2 px-3 py-2 text-sm text-k-ink">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-k-danger" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

/** Full-width primary action with a spinner while busy; the label keeps its place (no layout shift). */
export function AuthSubmit({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={busy} aria-busy={busy}>
      {busy && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
      {busy ? busyLabel : label}
    </Button>
  );
}

/** "No account yet? Create one" under the card content. */
export function AuthSwitch({ children }: { children: React.ReactNode }) {
  return <p className="mt-7 border-t border-k-line pt-5 text-sm text-k-muted">{children}</p>;
}
