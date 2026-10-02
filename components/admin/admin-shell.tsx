import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ADMIN } from "@/lib/admin/strings";
import { AdminNav } from "./admin-nav";

/** The admin console frame: dark, visibly different from the customer application. */
export function AdminShell({ email, children }: { email: string | null; children: React.ReactNode }) {
  return (
    <div lang="et" className="flex min-h-svh flex-col bg-k-surface">
      <header className="bg-k-ink text-white">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-[var(--k-gutter-app)] py-2">
          <Link href="/admin" className="focus-on-dark inline-flex min-h-11 items-center gap-2 rounded-sm font-bold">
            <ShieldCheck className="size-5 text-k-volt" aria-hidden="true" />
            {ADMIN.brand}
          </Link>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 text-sm text-white/75">
            <span className="min-w-0 truncate">{email}</span>
            <Link href="/o" className="focus-on-dark inline-flex min-h-11 items-center font-semibold text-white underline underline-offset-4">
              {ADMIN.backToApp}
            </Link>
          </div>
        </div>
        <AdminNav />
      </header>
      <p className="border-b border-k-line bg-k-paper-2">
        <span className="mx-auto block max-w-6xl px-[var(--k-gutter-app)] py-2 text-sm text-k-muted">{ADMIN.notice}</span>
      </p>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-[var(--k-gutter-app)] pb-16 pt-8">{children}</main>
    </div>
  );
}
