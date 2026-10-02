import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { CreateOrganisationForm } from "@/components/organisations/create-organisation-form";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.createOrganisation.title };
}

export default async function NewOrganisationPage() {
  const t = await getT();
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
