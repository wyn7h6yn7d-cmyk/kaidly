import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { LoadingBlock } from "@/components/app/states";
import { ProfileForm } from "@/components/organisations/profile-form";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.app.account.title };

async function Profile() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();
  return <ProfileForm profile={{ fullName: user.fullName, email: user.email, phone: data?.phone ?? null }} />;
}

export default function AccountPage() {
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
    </PlainPage>
  );
}
