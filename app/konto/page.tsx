import type { Metadata } from "next";
import { Suspense } from "react";
import { LanguageSelector } from "@/components/app/language-selector";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { LoadingBlock } from "@/components/app/states";
import { EmailChangeForm } from "@/components/account/email-change-form";
import { PasswordChangeForm } from "@/components/account/password-change-form";
import { SignOutHere } from "@/components/account/sign-out-here";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { ProfileForm } from "@/components/organisations/profile-form";
import { signOutOtherSessions } from "@/lib/actions/account";
import { contactMailto } from "@/lib/access";
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
  return <ProfileForm profile={{ fullName: user.fullName, phone: data?.phone ?? null }} />;
}

async function Email() {
  const user = await requireUser();
  return <EmailChangeForm currentEmail={user.email} />;
}

function Section({ id, title, body, children }: { id: string; title: string; body?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 border-t border-k-line pt-8">
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {body && <p className="mt-1 max-w-2xl text-k-muted">{body}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

async function DeletionRequest() {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  const copy = t.app.account;
  // Server setting, never hard-coded; without it the text says to contact KAIDLY.
  const href = contactMailto(process.env.KAIDLY_CONTACT_EMAIL, copy.deletionSubject(user.email ?? user.id));
  return href ? (
    <a href={href} className="inline-flex min-h-11 items-center font-semibold text-k-green underline underline-offset-4">
      {copy.deletionRequest}
    </a>
  ) : (
    <p className="text-sm">{copy.deletionNoContact}</p>
  );
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
      <Section id="email" title={t.app.account.emailTitle}>
        <Suspense fallback={<LoadingBlock lines={2} />}>
          <Email />
        </Suspense>
      </Section>
      <Section id="password" title={t.app.account.passwordTitle} body={t.app.account.passwordBody}>
        <PasswordChangeForm />
      </Section>
      <Section id="language" title={t.common.language} body={t.app.account.languageHint}>
        <LanguageSelector className="-ml-2" />
      </Section>
      <Section id="sessions" title={t.app.account.sessionsTitle} body={t.app.account.sessionsBody}>
        <div className="flex flex-wrap items-start gap-3">
          <ConfirmForm
            action={signOutOtherSessions}
            fields={{}}
            confirm={t.app.account.signOutOthersConfirm}
            label={t.app.account.signOutOthers}
            size="sm"
          />
          <SignOutHere />
        </div>
      </Section>
      <Section id="deletion" title={t.app.account.deletionTitle} body={t.app.account.deletionBody}>
        <Suspense fallback={null}>
          <DeletionRequest />
        </Suspense>
      </Section>
    </PlainPage>
  );
}
