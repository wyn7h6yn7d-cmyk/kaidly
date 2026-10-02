import type { Metadata } from "next";
import Link from "next/link";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { Button } from "@/components/ui/button";
import { OrganisationSettingsForm } from "@/components/organisations/organisation-settings-form";
import { hasRole } from "@/lib/auth/roles";
import { SettingsTabs } from "@/components/organisations/settings-tabs";
import { leaveOrganisation } from "@/lib/actions/organisations";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.settings.title };
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-k-line py-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-semibold text-k-muted">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

export default async function SettingsPage({ params }: { params: Promise<{ org: string }> }) {
  const t = await getT();
  return (
    <OrgPage
      params={params}
      render={({ org, role, memberRole }) => (
        <>
          <PageHeader eyebrow={org.name} title={t.app.settings.title} />
          <SettingsTabs orgSlug={org.slug} active="organisation" showHistory={hasRole(memberRole, "admin")} />

          <section aria-labelledby="org-details">
            <h2 id="org-details" className="text-xl font-bold">
              {t.app.settings.organisationTitle}
            </h2>
            <p className="mb-4 mt-1 max-w-2xl text-sm text-k-muted">{t.app.emptyStates.settings.organisation}</p>
            {/* Owners and admins edit the details (enforced by RLS and column grants). */}
            {hasRole(role, "admin") && !org.deactivatedAt ? (
              <OrganisationSettingsForm organisation={org} />
            ) : (
              <>
                <p className="mb-4 text-sm text-k-muted">{t.app.settings.ownerOnly}</p>
                <dl className="max-w-2xl border-t border-k-line">
                  <ReadOnlyRow label={t.app.createOrganisation.name} value={org.name} />
                  <ReadOnlyRow label={t.app.createOrganisation.registryCode} value={org.registryCode ?? "—"} />
                  <ReadOnlyRow label={t.app.settings.contactEmail} value={org.contactEmail ?? "—"} />
                  <ReadOnlyRow label={t.app.settings.contactPhone} value={org.contactPhone ?? "—"} />
                  <ReadOnlyRow label={t.app.settings.postalAddress} value={org.address ?? "—"} />
                  <ReadOnlyRow label={t.app.settings.notes} value={org.notes ?? "—"} />
                </dl>
              </>
            )}
            <dl className="mt-6 max-w-2xl">
              <ReadOnlyRow label={t.app.settings.address} value={`/o/${org.slug}`} />
            </dl>
            <p className="mt-2 max-w-2xl text-sm text-k-muted">{t.app.settings.addressHint}</p>
          </section>

          <section aria-labelledby="leave" className="mt-12 max-w-2xl border-t border-k-line pt-8">
            <h2 id="leave" className="text-xl font-bold">
              {t.app.settings.leaveTitle}
            </h2>
            <p className="mb-4 mt-1 text-k-muted">{t.app.settings.leaveBody}</p>
            <ConfirmForm
              action={leaveOrganisation}
              fields={{ organisationId: org.id }}
              confirm={t.app.settings.leaveConfirm}
              label={t.app.settings.leave}
              variant="destructive"
              size="default"
            />
          </section>
          {memberRole === "owner" && (
            <section aria-labelledby="danger" className="mt-12 max-w-2xl border-t-2 border-k-danger pt-8">
              <h2 id="danger" className="text-xl font-bold">
                {t.app.lifecycle.dangerTitle}
              </h2>
              <p className="mb-4 mt-1 text-k-muted">{t.app.lifecycle.dangerBody}</p>
              <Button asChild variant="outline" className="border-k-danger text-k-danger hover:bg-k-danger/5">
                <Link href={`/o/${org.slug}/seaded/kustuta`}>{t.app.lifecycle.dangerLink}</Link>
              </Button>
            </section>
          )}
        </>
      )}
    />
  );
}
