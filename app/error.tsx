"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/**
 * Any server or rendering error below the root layout: a calm, translated message. The
 * error itself is logged on the server (instrumentation.ts); users only see the short
 * reference code, never SQL, stack traces or provider messages.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-[60svh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-3xl font-extrabold">{t.errorPage.title}</h1>
      <p className="mt-3 text-k-muted">{t.errorPage.body}</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-k-muted">#{error.digest}</p>}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={reset}>{t.errorPage.retry}</Button>
        <Button asChild variant="outline">
          <Link href="/">{t.errorPage.home}</Link>
        </Button>
      </div>
    </main>
  );
}
