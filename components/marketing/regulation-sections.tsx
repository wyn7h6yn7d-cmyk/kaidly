import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";
import { OFFICIAL_LINKS } from "@/lib/legal-links";

function OfficialLink({ href, children, newWindow }: { href: string; children: ReactNode; newWindow: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-k-green underline underline-offset-4 hover:text-k-ink"
    >
      {children}
      <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      <span className="sr-only">({newWindow})</span>
    </a>
  );
}

/**
 * Two short sections right after the hero (owner text, 2026-11-20): who must appoint an
 * operations manager, and what that means for the periodic audit. Statements are the
 * owner's exact wording with links to the official sources; no product claims beyond what
 * the app does today (the audit package button comes later, separately).
 */
export async function RegulationSections() {
  const t = await getT();
  const w = t.landing.whoNeeds;
  const a = t.landing.auditReady;

  return (
    <>
      <section aria-labelledby="kes-vajab-title" data-section="who-needs" className="border-b border-k-line bg-k-paper">
        <div className="k-container k-section grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          <h2 id="kes-vajab-title" className="min-w-0 font-display text-display-2 font-extrabold [overflow-wrap:break-word] lg:col-span-5">
            {w.title}
          </h2>
          <div className="min-w-0 lg:col-span-7">
            <p className="text-lead">{w.intro}</p>
            <ul className="mt-6 divide-y divide-k-line border-y border-k-line">
              {w.items.map((item) => (
                <li key={item} className="flex gap-4 py-4 text-[17px] lg:text-lg">
                  <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 bg-k-volt" />
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-k-muted">{w.note}</p>
            <p className="mt-2 flex flex-wrap gap-x-6 text-sm">
              <OfficialLink href={OFFICIAL_LINKS.equipmentSafetyAct} newWindow={w.newWindow}>
                {w.lawLink}
              </OfficialLink>
              <OfficialLink href={OFFICIAL_LINKS.ttja} newWindow={w.newWindow}>
                {w.ttjaLink}
              </OfficialLink>
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="audit-title" data-section="audit-ready" className="border-b border-k-line bg-k-paper-2">
        <div className="k-container k-section grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          <h2 id="audit-title" className="min-w-0 font-display text-display-2 font-extrabold [overflow-wrap:break-word] lg:col-span-5">
            {a.title}
          </h2>
          <div className="min-w-0 border-l-4 border-k-volt pl-5 lg:col-span-7">
            <p className="text-lead">{a.body}</p>
            <p className="mt-4 text-sm">
              <OfficialLink href={OFFICIAL_LINKS.ttjaAuditGuide} newWindow={w.newWindow}>
                {a.guideLink}
              </OfficialLink>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
