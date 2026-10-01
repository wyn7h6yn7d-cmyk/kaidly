import Link from "next/link";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

// A record inside an organisation that doesn't exist or belongs to another organisation.
export default function RecordNotFound() {
  return (
    <section className="max-w-xl">
      <h1 className="text-3xl font-extrabold">{t.app.notFound.pageTitle}</h1>
      <p className="mt-3 text-k-muted">{t.app.notFound.pageBody}</p>
      <Button asChild variant="outline" className="mt-8">
        <Link href="/o">{t.app.notFound.toOrganisations}</Link>
      </Button>
    </section>
  );
}
