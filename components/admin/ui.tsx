import Link from "next/link";
import { ADMIN } from "@/lib/admin/strings";
import { cn } from "@/lib/utils";

export function AdminTitle({ title, intro, children }: { title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {intro && <p className="mt-2 max-w-3xl text-k-muted">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  return (
    <div className="min-w-0 border-l-4 border-k-line py-1 pl-3" data-tone={tone}>
      <dt className="text-sm text-k-muted">{label}</dt>
      <dd
        className={cn(
          "text-2xl font-bold tabular-nums",
          tone === "warn" && "text-k-warn",
          tone === "danger" && "text-k-danger",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function Section({ title, children, id }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10 min-w-0">
      <h2 id={id} className="mb-3 text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Tables scroll inside their own frame on narrow screens; the page never does. */
export function TableFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="relative max-w-full overflow-x-auto border border-k-line">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export const th = "border-b border-k-line bg-k-paper-2 px-3 py-2 font-semibold";
export const td = "border-b border-k-line px-3 py-2 align-top";

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" | "danger" | "ok" }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-xs font-semibold",
        tone === "neutral" && "border-k-line text-k-muted",
        tone === "warn" && "border-k-warn text-k-warn",
        tone === "danger" && "border-k-danger text-k-danger",
        tone === "ok" && "border-k-green text-k-green",
      )}
    >
      {children}
    </span>
  );
}

export function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="max-w-3xl border-t border-k-line">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 border-b border-k-line py-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4">
          <dt className="text-sm font-semibold text-k-muted">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pager({ page, total, size, href }: { page: number; total: number; size: number; href: (page: number) => string }) {
  if (total <= size) return null;
  return (
    <nav aria-label="Lehed" className="mt-4 flex gap-4">
      {page > 0 && (
        <Link className="inline-flex min-h-11 items-center font-semibold text-k-green underline" href={href(page - 1)}>
          {ADMIN.table.previous}
        </Link>
      )}
      {(page + 1) * size < total && (
        <Link className="inline-flex min-h-11 items-center font-semibold text-k-green underline" href={href(page + 1)}>
          {ADMIN.table.next}
        </Link>
      )}
    </nav>
  );
}

export function SearchForm({ action, label, value }: { action: string; label: string; value?: string }) {
  return (
    <form action={action} method="get" role="search" className="mb-4 flex max-w-xl flex-wrap gap-2">
      <label htmlFor="admin-search" className="sr-only">
        {label}
      </label>
      <input
        id="admin-search"
        name="q"
        type="search"
        defaultValue={value}
        placeholder={label}
        className="min-h-11 min-w-0 flex-1 rounded-sm border border-k-line bg-k-surface px-3 text-base"
      />
      <button type="submit" className="min-h-11 rounded-sm bg-k-green px-4 font-semibold text-white hover:bg-k-green-hover">
        {ADMIN.users.searchButton}
      </button>
    </form>
  );
}
