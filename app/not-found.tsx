import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";


export default async function NotFound() {
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
      <Logo className="mb-10" />
      <h1 className="text-3xl font-extrabold">{t.app.notFound.pageTitle}</h1>
      <Button asChild className="mt-8 self-start">
        <Link href="/">{t.app.back}</Link>
      </Button>
    </main>
  );
}
