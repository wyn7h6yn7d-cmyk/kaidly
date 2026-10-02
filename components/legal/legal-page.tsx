import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getT } from "@/lib/i18n/server";
import { LEGAL_CONTENT } from "@/lib/legal/content";
import { LEGAL, legalReady } from "@/lib/legal/operator";

type Field = "operatorName" | "registryCode" | "address" | "privacyEmail" | "effectiveDate" | "hostingRegion";

/** Renders a legal document; any operator fact still missing is shown as such, never invented. */
export async function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  const t = await getT();
  const content = LEGAL_CONTENT[t.locale];
  const d = content[doc];
  const fill = (text: string) =>
    text.split(/(\{[a-zA-Z]+\})/).map((part, i) => {
      const key = /^\{([a-zA-Z]+)\}$/.exec(part)?.[1] as Field | undefined;
      if (!key) return part;
      const value = LEGAL[key];
      return value ? (
        value
      ) : (
        <mark key={i} className="border border-dashed border-k-warn bg-k-surface px-1 font-semibold text-k-ink">
          [{content.missing[key]}]
        </mark>
      );
    });
  return (
    <div className="flex min-h-svh flex-col bg-k-paper text-k-ink">
      <SiteHeader />
      <main className="k-container flex-1 py-12 lg:py-16">
        <article className="max-w-3xl">
          {!legalReady() && (
            <p role="note" className="mb-8 border-l-4 border-k-warn bg-k-surface px-4 py-3 font-semibold">
              {content.draft}
            </p>
          )}
          <h1 className="font-display text-display-2 font-extrabold">{d.title}</h1>
          <p className="mt-4 text-lead text-k-muted">{d.intro}</p>
          <p className="mt-2 text-sm text-k-muted">
            {content.updated}: {LEGAL.effectiveDate ? t.fmt.date(LEGAL.effectiveDate) : fill("{effectiveDate}")}
          </p>
          {d.sections.map((s) => (
            <section key={s.heading} className="mt-10">
              <h2 className="text-xl font-bold lg:text-2xl">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-3 max-w-[70ch] text-[17px] leading-relaxed lg:text-lg">
                  {fill(p)}
                </p>
              ))}
            </section>
          ))}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
