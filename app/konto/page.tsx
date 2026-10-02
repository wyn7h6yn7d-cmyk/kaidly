import type { Metadata } from "next";
import { Suspense } from "react";
import { LanguageSelector } from "@/components/app/language-selector";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { LoadingBlock } from "@/components/app/states";
import { ProfileForm } from "@/components/organisations/profile-form";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.account.title };
}

async function Profile() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();
  return <ProfileForm profile={{ fullName: user.fullName, email: user.email, phone: data?.phone ?? null }} />;
}

export default async function AccountPage() {
  const t = await getT();
  return (
    <PlainPage>
      <PageHeader
        title={t.app.account.title}
        description={t.app.account.description}
        back={{ href: "/o", label: t.app.back }}
      />
      <Suspense fallback={<LoadingBlock lines={2} />}>
        <Profile />
      </Suspense>
      <section aria-labelledby="language" className="mt-12 border-t border-k-line pt-8">
        <h2 id="language" className="text-lg font-bold">
          {t.common.language}
        </h2>
        <p className="mt-1 text-k-muted">{t.app.account.languageHint}</p>
        <LanguageSelector className="-ml-2 mt-3" />
      </section>
    </PlainPage>
  );
}
