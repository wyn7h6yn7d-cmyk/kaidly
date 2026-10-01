"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** The installation header's main action — hidden while the user is already on an entry form. */
export function NewEntryButton({ href }: { href: string }) {
  const pathname = usePathname();
  if (pathname.endsWith("/paevik/uus") || pathname.endsWith("/paranda")) return null;
  return (
    <Button asChild size="lg" className="w-full sm:w-auto">
      <Link href={href}>
        <Plus aria-hidden="true" />
        {t.app.log.add}
      </Link>
    </Button>
  );
}
