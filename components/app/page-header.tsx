import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Strong left-aligned title with context above and the primary action at the right
 * (desktop) or below (mobile). docs/DESIGN.md §5.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  back,
  actions,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-k-line pb-6">
      {back && (
        <Link
          href={back.href}
          className="-ml-1 mb-3 inline-flex h-9 items-center gap-1 rounded-sm pr-2 text-sm font-medium text-k-muted hover:text-k-ink"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-k-muted">
              {eyebrow}
            </p>
          )}
          <h1 className="break-words text-[28px] font-extrabold leading-tight sm:text-[32px]">
            {title}
          </h1>
          {description && <div className="mt-2 max-w-2xl text-k-muted">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
