import Link from "next/link";
import { PlainShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

// Shown when /o/[org] is unknown or the user is not a member — deliberately the same
// page for both, so organisation slugs can't be probed.
export default function OrganisationNotFound() {
  return (
    <PlainShell userMenu={null}>
      <h1 className="text-3xl font-extrabold">{t.app.notFound.orgTitle}</h1>
      <p className="mt-3 max-w-xl text-k-muted">{t.app.notFound.orgBody}</p>
      <Button asChild className="mt-8">
        <Link href="/o?vali=1">{t.app.notFound.toOrganisations}</Link>
      </Button>
    </PlainShell>
  );
}
