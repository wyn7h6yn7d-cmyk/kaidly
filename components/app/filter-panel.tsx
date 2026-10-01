import Link from "next/link";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/**
 * GET filter form (works without JavaScript; filters live in the URL so they can be
 * shared and survive reloads). Collapsed until filters are active, so lists start high
 * on the screen on phones.
 */
export function FilterPanel({
  action,
  activeCount,
  children,
}: {
  action: string;
  activeCount: number;
  children: React.ReactNode;
}) {
  const copy = t.app.log.filters;
  return (
    <details className="group mb-6 border border-k-line bg-k-surface" open={activeCount > 0 || undefined}>
      <summary className="flex h-12 cursor-pointer items-center justify-between px-4 font-semibold">
        <span>
          {copy.title}
          {activeCount > 0 && <span className="ml-2 text-k-green">({activeCount})</span>}
        </span>
        <span aria-hidden="true" className="text-k-muted group-open:rotate-180">
          ▾
        </span>
      </summary>
      <form action={action} method="get" className="grid gap-4 border-t border-k-line p-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
        <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-3">
          <Button type="submit">{copy.apply}</Button>
          {activeCount > 0 && (
            <Link href={action} className="flex h-11 items-center px-2 font-semibold text-k-green underline underline-offset-4">
              {copy.clear}
            </Link>
          )}
        </div>
      </form>
    </details>
  );
}
