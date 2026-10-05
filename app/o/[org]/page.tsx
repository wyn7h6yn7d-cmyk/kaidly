import Link from "next/link";
import { Bell, ChevronRight, Plus, UserPlus } from "lucide-react";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { AttentionRow, AttentionSection, OnboardingChecklist } from "@/components/dashboard/sections";
import { getOnboarding } from "@/lib/data/onboarding";
import { SeverityMark, StatusBadge } from "@/components/deficiencies/marks";
import { DueMark } from "@/components/schedule/due-mark";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/lib/auth/roles";
import { getDashboard } from "@/lib/data/dashboard";
import { listInstallationOptions } from "@/lib/data/log";
import { getOverviewCounts, listSites } from "@/lib/data/sites";
import { installationLabel } from "@/lib/labels";
import { getT } from "@/lib/i18n/server";


const SITES_SHOWN = 8;

export default async function OverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ uus?: string }>;
}) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      render={async (ctx) => {
        const { org, role } = ctx;
        const [counts, sites, dashboard, installations, onboarding, query] = await Promise.all([
          getOverviewCounts(org.id),
          listSites(org.id),
          getDashboard(org.id),
          listInstallationOptions(org.id),
          getOnboarding(ctx),
          searchParams,
        ]);
        const welcome = query.uus !== undefined && !onboarding.complete;
        const isAdmin = hasRole(role, "admin");
        const canWrite = hasRole(role, "operator");
        const base = `/o/${org.slug}`;
        const copy = t.app.dashboard;
        const byId = new Map(installations.map((i) => [i.id, i]));
        const where = (installationId: string) => {
          const i = byId.get(installationId);
          return i ? installationLabel(i) : null;
        };

        // A new company working through the guide has nothing to attend to yet: show the
        // attention panel once there is something in it, or once the guide is done/hidden.
        const hasOperationalData =
          dashboard.hasAnyEntry || dashboard.overdue.total + dashboard.dueSoon.total + dashboard.serious.total > 0;
        const guideOpen = !onboarding.complete && !onboarding.hidden;
        const showAttention = counts.installations > 0 && (hasOperationalData || !guideOpen);
        const attentionCount = dashboard.overdue.total + dashboard.serious.total;

        return (
          <>
            <PageHeader
              eyebrow={t.app.nav.overview}
              title={org.name}
              description={`${t.app.organisations.yourRole}: ${t.roles[ctx.memberRole]}`}
              actions={
                <>
                  {canWrite && counts.installations > 0 && (
                    <Button asChild size="lg" className="w-full sm:w-auto">
                      <Link href={`${base}/sissekanne`}>
                        <Plus aria-hidden="true" />
                        {copy.quickEntry}
                      </Link>
                    </Button>
                  )}
                  {isAdmin && (
                    <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                      <Link href={`${base}/seaded/liikmed`}>
                        <UserPlus aria-hidden="true" />
                        {t.app.invitations.title}
                      </Link>
                    </Button>
                  )}
                </>
              }
            />

            {welcome && (
              <section aria-labelledby="welcome" className="mb-8 border-l-4 border-k-volt bg-k-surface px-4 py-5 sm:px-6">
                <h2 id="welcome" className="text-xl font-bold">
                  {t.app.onboarding.welcomeTitle}
                </h2>
                <p className="mt-1 text-k-muted">{t.app.onboarding.welcomeBody}</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  {isAdmin && (
                    <Button asChild size="lg">
                      <Link href={`${base}/objektid/uus`}>{t.app.onboarding.welcomeCta}</Link>
                    </Button>
                  )}
                  <Button asChild size="lg" variant="outline">
                    <Link href={`${base}/abi`}>{t.app.onboarding.welcomeGuide}</Link>
                  </Button>
                </div>
              </section>
            )}

            {!onboarding.complete && !onboarding.hidden && (
              <div className="mb-10 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
                {/* The membership role decides who waits for an administrator; an expired company's
                    admin sees the guide, which then names the ended trial as the blocker. */}
                {counts.sites === 0 && !hasRole(ctx.memberRole, "admin") ? (
                  <EmptyState title={t.app.emptyStates.sites.title} body={t.app.onboarding.memberWaiting} />
                ) : (
                  <OnboardingChecklist orgSlug={org.slug} steps={onboarding.steps} hideable />
                )}
                {/* Real product guidance, not filler: how deadlines and reminders will work. */}
                <aside aria-labelledby="reminders-card" className="border border-k-line bg-k-surface px-5 py-5">
                  <h2 id="reminders-card" className="flex items-center gap-2 font-bold">
                    <Bell className="size-4 text-k-green" aria-hidden="true" />
                    {t.app.help.reminders.title}
                  </h2>
                  <p className="mt-2 text-[15px] text-k-ink/75">{t.app.help.reminders.card}</p>
                  <Link href={`${base}/abi#meeldetuletused`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-k-green underline underline-offset-4">
                    {t.app.help.reminders.cardLink}
                  </Link>
                </aside>
              </div>
            )}

            {showAttention && (
              <section aria-labelledby="attention" className="mb-12">
                <h2 id="attention" className="text-xl font-bold">
                  {copy.attentionTitle}
                </h2>
                {attentionCount === 0 && <p className="mt-1 text-k-muted">{copy.allClear}</p>}

                <ul aria-label={copy.summaryLabel} className="mt-4 grid grid-cols-3 border-y border-k-line">
                  {[
                    { label: copy.overdue, value: dashboard.overdue.total, href: `${base}/kaidukava?seis=overdue`, tone: "text-k-danger" },
                    { label: copy.dueSoon, value: dashboard.dueSoon.total, href: `${base}/kaidukava?seis=soon`, tone: "text-k-ink" },
                    { label: copy.serious, value: dashboard.serious.total, href: `${base}/puudused`, tone: "text-k-danger" },
                  ].map((stat) => (
                    <li key={stat.label} className="min-w-0 border-l border-k-line first:border-l-0">
                      <Link href={stat.href} className="flex h-full flex-col gap-1 px-3 py-3 hover:bg-k-paper-2 sm:px-4">
                        <span className={`text-2xl font-extrabold tabular-nums sm:text-3xl ${stat.value > 0 ? stat.tone : "text-k-muted"}`}>
                          {stat.value}
                        </span>
                        <span className="text-xs font-medium leading-snug text-k-muted sm:text-sm">{stat.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 grid gap-10 lg:grid-cols-2">
                  <AttentionSection
                    id="attention-overdue"
                    title={copy.overdue}
                    total={dashboard.overdue.total}
                    allHref={`${base}/kaidukava?seis=overdue`}
                    empty={copy.empty.overdue}
                  >
                    {dashboard.overdue.items.map((a) => (
                      <AttentionRow
                        key={a.id}
                        href={`${base}/kaidukava/${a.id}`}
                        title={a.title}
                        context={where(a.installationId)}
                        mark={<DueMark nextDueOn={a.nextDueOn} today={dashboard.today} />}
                      />
                    ))}
                  </AttentionSection>

                  <AttentionSection
                    id="attention-serious"
                    title={copy.serious}
                    total={dashboard.serious.total}
                    allHref={`${base}/puudused`}
                    empty={copy.empty.serious}
                  >
                    {dashboard.serious.items.map((d) => (
                      <AttentionRow
                        key={d.id}
                        href={`${base}/puudused/${d.id}`}
                        title={d.title}
                        context={where(d.installationId)}
                        mark={
                          <>
                            <SeverityMark severity={d.severity} />
                            <StatusBadge status={d.status} />
                          </>
                        }
                      />
                    ))}
                  </AttentionSection>

                  <AttentionSection
                    id="attention-soon"
                    title={copy.dueSoon}
                    total={dashboard.dueSoon.total}
                    allHref={`${base}/kaidukava?seis=soon`}
                    empty={copy.empty.dueSoon}
                  >
                    {dashboard.dueSoon.items.map((a) => (
                      <AttentionRow
                        key={a.id}
                        href={`${base}/kaidukava/${a.id}`}
                        title={a.title}
                        context={where(a.installationId)}
                        mark={<DueMark nextDueOn={a.nextDueOn} today={dashboard.today} />}
                      />
                    ))}
                  </AttentionSection>

                  <AttentionSection
                    id="attention-recent"
                    title={copy.recent}
                    total={dashboard.recent.length}
                    allHref={`${base}/paevik`}
                    allLabel={copy.openLog}
                    empty={copy.empty.recent}
                  >
                    {dashboard.recent.map((entry) => (
                      <AttentionRow
                        key={entry.id}
                        href={`${base}/paigaldised/${entry.installationId}/paevik/${entry.id}`}
                        title={entry.description}
                        context={`${t.fmt.dateTime(entry.occurredAt)} · ${t.app.log.types[entry.entryType]} · ${where(entry.installationId) ?? ""}`}
                      />
                    ))}
                  </AttentionSection>
                </div>
              </section>
            )}

            {showAttention && (dashboard.sites.length > 0 || !guideOpen) && (
              <section aria-labelledby="attention-sites" className="mb-12">
                <h2 id="attention-sites" className="mb-3 text-xl font-bold">
                  {copy.sites}
                </h2>
                {dashboard.sites.length === 0 ? (
                  <p className="text-k-muted">{copy.sitesAllClear}</p>
                ) : (
                  <ul aria-label={copy.sites} className="divide-y divide-k-line border border-k-line bg-k-surface">
                    {dashboard.sites.map((site) => (
                      <li key={site.siteId}>
                        <Link
                          href={`${base}/objektid/${site.siteId}`}
                          className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-k-paper-2 sm:px-5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{site.name}</span>
                            <span className="block text-sm text-k-muted">
                              {[
                                site.overdueActivities > 0 && copy.siteCounts.overdue(site.overdueActivities),
                                site.dueSoonActivities > 0 && copy.siteCounts.dueSoon(site.dueSoonActivities),
                                site.openDeficiencies > 0 &&
                                  `${copy.siteCounts.open(site.openDeficiencies)}${
                                    site.seriousDeficiencies > 0 ? ` (${copy.siteCounts.serious(site.seriousDeficiencies)})` : ""
                                  }`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <ChevronRight className="size-5 shrink-0 text-k-grey" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {sites.length > 0 && (
              <section aria-labelledby="overview-sites">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 id="overview-sites" className="text-xl font-bold">
                    {t.app.overview.sitesTitle}
                  </h2>
                  <p className="text-sm tabular-nums text-k-muted">
                    {t.app.overview.counts(counts.sites, counts.installations)}
                  </p>
                </div>
                <ul aria-label={t.app.overview.sitesTitle} className="divide-y divide-k-line border border-k-line bg-k-surface">
                  {sites.slice(0, SITES_SHOWN).map((site) => (
                    <li key={site.id}>
                      <Link
                        href={`${base}/objektid/${site.id}`}
                        className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-k-paper-2 sm:px-5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{site.name}</span>
                          {site.address && <span className="block truncate text-sm text-k-muted">{site.address}</span>}
                        </span>
                        <span className="shrink-0 text-sm tabular-nums text-k-muted">
                          {t.app.sites.installationsCount(site.installationCount)}
                        </span>
                        <ChevronRight className="size-5 shrink-0 text-k-grey" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-4">
                  <Link href={`${base}/objektid`} className="text-sm font-semibold text-k-green underline underline-offset-4">
                    {t.app.overview.allSites}
                  </Link>
                </p>
              </section>
            )}
          </>
        );
      }}
    />
  );
}
