import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { LoadingBlock } from "@/components/app/states";
import { requirePlatformAdmin } from "@/lib/data/admin";

// No admin wording in the metadata or the loading state: someone who isn't a platform
// admin gets the ordinary 404 and learns nothing about this area.
export const metadata: Metadata = { robots: { index: false, follow: false } };

async function AdminFrame({ children }: { children: React.ReactNode }) {
  // Not the security boundary on its own: every admin read and write is checked again by
  // the database (private.is_platform_admin()).
  const user = await requirePlatformAdmin();
  return <AdminShell email={user.email}>{children}</AdminShell>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-[var(--k-gutter-app)] pt-12">
          <LoadingBlock lines={3} />
        </div>
      }
    >
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}
