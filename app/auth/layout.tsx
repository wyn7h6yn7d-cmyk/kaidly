import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { t } from "@/lib/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-md items-center px-4">
        <Link href="/" aria-label={t.brand.name} className="rounded-sm">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-16 pt-6 sm:pt-12">
        {children}
      </main>
    </div>
  );
}
