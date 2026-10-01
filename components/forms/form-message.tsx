import { CircleCheck } from "lucide-react";

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p role="alert" className="border-l-4 border-k-danger bg-k-surface px-3 py-2 text-sm text-k-ink">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-medium text-k-green">
        <CircleCheck className="size-4" aria-hidden="true" />
        {success}
      </p>
    );
  }
  return null;
}
