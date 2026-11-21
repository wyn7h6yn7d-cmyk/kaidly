import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Download, ExternalLink, Eye, FileCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { LoadingBlock } from "@/components/app/states";
import { DueMark } from "@/components/schedule/due-mark";
import { Button } from "@/components/ui/button";
import { getSiteNearestAudit } from "@/lib/data/audits";
import { getViewerSite } from "@/lib/data/site-viewers";
import { getT } from "@/lib/i18n/server";
import { todayInTallinn } from "@/lib/time";

// Reads request data (session, language cookie, params): allowed to block on navigation
// instead of claiming an instant static shell (Next 16.4 instant validation).
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.viewer.title, referrer: "no-referrer" };
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 first:mt-0">
      <h2 id={id} className="mb-4 text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Objekti vaataja: one site, read-only. Rows come through the viewer's own session (RLS:
 * private.viewer_site_ids); anything unknown, foreign, revoked or inactive is a 404.
 * No forms, no write actions.
 */
async function SiteView({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ lk?: string }> }) {
  const t = await getT();
  const [{ site: siteId }, { lk }] = await Promise.all([params, searchParams]);
  const page = Number.parseInt(lk ?? "0", 10);
  const data = await getViewerSite(siteId, Number.isFinite(page) && page > 0 ? page : 0);
  if (!data) notFound();
  const v = t.app.viewer;
  const today = todayInTallinn();
  const inst = new Map(data.installations.map((i) => [i.id, [i.identifier, i.name].filter(Boolean).join(" ")]));
  const open = data.deficiencies.filter((d) => d.status !== "resolved");
  const closed = data.deficiencies.filter((d) => d.status === "resolved");
  const base = `/vaade/${data.site.id}`;
  const nearestAudit = await getSiteNearestAudit(data.site.id);

  return (
    <>
      <PageHeader
        title={data.site.name}
        description={[data.site.address, `${v.manager}: ${data.access.organisationName}`].filter(Boolean).join(" · ")}
        back={{ href: "/vaade?vali=1", label: v.back }}
        actions={
          <>
            <Button asChild>
              <a href={`${base}/auditipakett`} download>
                <FileCheck aria-hidden="true" />
                {t.app.auditPackage.button}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`${base}/aruanne`} download>
                <Download aria-hidden="true" />
                {v.download}
              </a>
            </Button>
          </>
        }
      />
      <p className="-mt-4 mb-10 inline-flex items-center gap-2 bg-k-paper-2 px-3 py-1.5 text-sm font-semibold" data-testid="read-only">
        <Eye aria-hidden="true" className="size-4" />
        {v.readOnly}
      </p>

      {nearestAudit && (
        <p className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 border-k-volt bg-k-surface px-4 py-3" data-testid="nearest-audit">
          <span className="font-semibold">{t.app.audits.nearest}:</span>
          <span>{t.fmt.date(nearestAudit.nextDueOn)}</span>
          <span className="text-k-muted">{nearestAudit.installation}</span>
          <DueMark nextDueOn={nearestAudit.nextDueOn} today={today} />
        </p>
      )}

      <Section id="v-installations" title={v.sections.installations}>
        {data.installations.length === 0 ? (
          <p className="text-k-muted">{v.none}</p>
        ) : (
          <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
            {data.installations.map((i) => (
              <li key={i.id} className="px-4 py-3 sm:px-5">
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  {i.identifier && <span className="font-mono text-sm font-semibold text-k-green">{i.identifier}</span>}
                  <span className="break-words text-[17px] font-semibold">{i.name}</span>
                </span>
                <span className="block text-sm text-k-muted">
                  {[t.app.installations.types[i.installation_type as keyof typeof t.app.installations.types], t.app.installations.statuses[i.status as keyof typeof t.app.installations.statuses]]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="v-plan" title={v.sections.plan}>
        {data.plan.length === 0 ? (
          <p className="text-k-muted">{v.none}</p>
        ) : (
          <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
            {data.plan.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
                <span className="min-w-0">
                  <span className="block break-words font-semibold">{a.title}</span>
                  <span className="block text-sm text-k-muted">
                    {[inst.get(a.electrical_installation_id), a.next_due_on ? `${v.due} ${t.fmt.date(a.next_due_on)}` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <DueMark nextDueOn={a.next_due_on} today={today} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="v-deficiencies" title={v.sections.deficiencies}>
        {[
          [v.open, open],
          [v.resolved, closed],
        ].map(([label, rows]) => (
          <div key={label as string} className="mb-6">
            <h3 className="mb-2 font-bold">
              {label as string} ({(rows as typeof open).length})
            </h3>
            {(rows as typeof open).length === 0 ? (
              <p className="text-k-muted">{v.none}</p>
            ) : (
              <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
                {(rows as typeof open).map((d) => (
                  <li key={d.id} className="px-4 py-3 sm:px-5">
                    <span className="block break-words font-semibold">{d.title}</span>
                    <span className="block text-sm text-k-muted">
                      {[
                        t.app.deficiencies.severities[d.severity],
                        t.app.deficiencies.statuses[d.status],
                        inst.get(d.electrical_installation_id),
                        t.fmt.date(d.detected_at),
                        d.due_on && d.status !== "resolved" ? `${v.due} ${t.fmt.date(d.due_on)}` : null,
                        d.resolved_at ? v.resolvedOn(t.fmt.date(d.resolved_at)) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {d.resolution && (
                      <span className="mt-1 block break-words text-sm">
                        <span className="font-semibold">{v.resolution}:</span> {d.resolution}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </Section>

      <Section id="v-log" title={v.sections.log}>
        {data.log.length === 0 ? (
          <p className="text-k-muted">{v.none}</p>
        ) : (
          <ol className="divide-y divide-k-line border border-k-line bg-k-surface">
            {data.log.map((e) => (
              <li key={e.id} className="px-4 py-3 sm:px-5">
                <span className="block text-sm text-k-muted">
                  {[t.fmt.dateTime(e.occurred_at), t.app.log.types[e.entry_type as keyof typeof t.app.log.types], inst.get(e.electrical_installation_id)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {e.correction_of_id && (
                  <span className="mt-1 inline-block bg-k-paper-2 px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
                    {v.correction}
                    {e.correction_reason ? `: ${e.correction_reason}` : ""}
                  </span>
                )}
                <span className="mt-1 block whitespace-pre-line break-words">{e.description}</span>
                {e.result && <span className="mt-1 block whitespace-pre-line break-words text-k-ink/85">{e.result}</span>}
                <span className="mt-1 block text-sm text-k-muted">
                  {[v.by(e.created_by_name), e.performed_by_name ? v.performedBy(e.performed_by_name) : null].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        )}
        {(data.logPage > 0 || data.logHasMore) && (
          <nav className="mt-4 flex flex-wrap gap-3" aria-label={v.sections.log}>
            {data.logPage > 0 && (
              <Button asChild variant="outline">
                <Link href={data.logPage === 1 ? `${base}#v-log` : `${base}?lk=${data.logPage - 1}#v-log`}>{v.newer}</Link>
              </Button>
            )}
            {data.logHasMore && (
              <Button asChild variant="outline">
                <Link href={`${base}?lk=${data.logPage + 1}#v-log`}>{v.older}</Link>
              </Button>
            )}
          </nav>
        )}
      </Section>

      {data.archivedInstallations.length > 0 && (
        <Section id="v-archived" title={v.archivedInstallations}>
          <ul className="divide-y divide-k-line border border-k-line bg-k-surface" data-testid="viewer-archived">
            {data.archivedInstallations.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="min-w-0 break-words font-semibold">{[i.identifier, i.name].filter(Boolean).join(" ")}</span>
                <span className="flex flex-wrap gap-x-4">
                  <a href={`${base}/auditipakett?paigaldis=${i.id}&alates=1990-01-01`} download className="inline-flex min-h-11 items-center font-semibold text-k-green underline underline-offset-4">
                    {v.packagePdf}
                  </a>
                  <a href={`${base}/eksport?paigaldis=${i.id}`} download className="inline-flex min-h-11 items-center font-semibold text-k-green underline underline-offset-4">
                    {v.logCsv}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="v-documents" title={v.sections.documents}>
        {data.documents.length === 0 ? (
          <p className="text-k-muted">{v.none}</p>
        ) : (
          <ul className="divide-y divide-k-line border border-k-line bg-k-surface">
            {data.documents.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="min-w-0">
                  <span className="block break-words font-semibold">{d.title}</span>
                  <span className="block text-sm text-k-muted">
                    {[t.app.documents.categories[d.category as keyof typeof t.app.documents.categories], d.electrical_installation_id ? inst.get(d.electrical_installation_id) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {d.external_url && (
                  <a
                    href={d.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 font-semibold text-k-green underline underline-offset-4"
                  >
                    {v.openLink}
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

export default function ViewerSitePage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ lk?: string }> }) {
  return (
    <PlainPage>
      <Suspense fallback={<LoadingBlock lines={6} />}>
        <SiteView params={params} searchParams={searchParams} />
      </Suspense>
    </PlainPage>
  );
}
