import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { CreateOrganisationForm } from "@/components/organisations/create-organisation-form";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.app.createOrganisation.title };

export default function NewOrganisationPage() {
  return (
    <PlainPage>
      <PageHeader
        title={t.app.createOrganisation.title}
        description={t.app.createOrganisation.description}
        back={{ href: "/o?vali=1", label: t.app.organisations.title }}
      />
      <CreateOrganisationForm />
    </PlainPage>
  );
}
