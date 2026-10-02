import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/data/admin";
import { PlainShell } from "./app-shell";
import { localeSyncNeeded } from "@/lib/i18n/server";
import { LocaleSync } from "./language-selector";
import { UserMenu } from "./user-menu";

async function CurrentUserMenu() {
  const user = await requireUser();
  const [syncNeeded, platformAdmin] = await Promise.all([localeSyncNeeded(user.preferredLocale), isPlatformAdmin()]);
  return (
    <>
      <LocaleSync needed={syncNeeded} />
      <UserMenu name={user.fullName} email={user.email} tone="dark" platformAdmin={platformAdmin} />
    </>
  );
}

/** Signed-in page outside an organisation, with the account menu in the header. */
export function PlainPage({ children }: { children: React.ReactNode }) {
  return (
    <PlainShell
      userMenu={
        <Suspense fallback={<div className="h-11 w-11" />}>
          <CurrentUserMenu />
        </Suspense>
      }
    >
      {children}
    </PlainShell>
  );
}
