import type { Metadata } from "next";
import { OrgPage } from "@/components/app/org-page";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { OrganisationSettingsForm } from "@/components/organisations/organisation-settings-form";
import { SettingsTabs } from "@/components/organisations/settings-tabs";
import { leaveOrganisation } from "@/lib/actions/organisations";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.app.settings.title };

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-k-line py-3 sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-sm font-semibold text-k-muted">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

export default function SettingsPage({ params }: { params: Promise<{ org: string }> }) {
  return (
    <OrgPage
      params={params}
      render={({ org, role }) => (
        <>
          <PageHeader eyebrow={org.name} title={t.app.settings.title} />
          <SettingsTabs orgSlug={org.slug} active="organisation" />

          <section aria-labelledby="org-details">
            <h2 id="org-details" className="mb-4 text-xl font-bold">
              {t.app.settings.organisationTitle}
            </h2>
            {role === "owner" ? (
              <OrganisationSettingsForm organisation={org} />
            ) : (
              <>
                <p className="mb-4 text-sm text-k-muted">{t.app.settings.ownerOnly}</p>
                <dl className="max-w-2xl border-t border-k-line">
                  <ReadOnlyRow label={t.app.createOrganisation.name} value={org.name} />
                  <ReadOnlyRow
                    label={t.app.createOrganisation.registryCode}
                    value={org.registryCode ?? "—"}
                  />
                </dl>
              </>
            )}
            <dl className="mt-6 max-w-2xl">
              <ReadOnlyRow label={t.app.settings.address} value={`/o/${org.slug}`} />
              <p className="mt-2 text-sm text-k-muted">{t.app.settings.addressHint}</p>
            </dl>
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
        </>
      )}
    />
  );
}
