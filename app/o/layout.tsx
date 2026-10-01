import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { UserMenu } from "@/components/app/user-menu";
import { requireUser } from "@/lib/auth/session";

async function CurrentUserMenu({ tone }: { tone: "dark" | "light" }) {
  const user = await requireUser();
  return <UserMenu name={user.fullName} email={user.email} tone={tone} />;
}

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  // Phase 1: no organisation yet, so the shell renders its navigation disabled.
  // Phase 2 adds /o/[org] with its own layout that passes the organisation slug.
  return (
    <AppShell
      sidebarFooter={
        <Suspense fallback={<div className="h-11" />}>
          <CurrentUserMenu tone="light" />
        </Suspense>
      }
      topBarEnd={
        <Suspense fallback={<div className="h-11 w-11" />}>
          <CurrentUserMenu tone="dark" />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
