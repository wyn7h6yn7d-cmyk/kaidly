import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { LoadingBlock } from "@/components/app/states";
import { AcceptInvitationForm } from "@/components/organisations/accept-invitation-form";
import { Button } from "@/components/ui/button";
import { previewInvitation } from "@/lib/data/organisations";
import { formatDate, t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.app.invite.title, referrer: "no-referrer" };

const STATUS_ERROR = {
  invalid: "invitation_invalid",
  expired: "invitation_expired",
  used: "invitation_used",
  revoked: "invitation_revoked",
} as const;

// Requires a session (the proxy sends anonymous visitors to login with ?next=/invite/…).
// Organisation details are shown only for a live invitation (invitation_preview).
async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await previewInvitation(token);

  if (preview.status !== "valid") {
    return (
      <>
        <p className="text-lg">{t.errors[STATUS_ERROR[preview.status]]}</p>
        <Button asChild variant="outline" className="mt-8">
          <Link href="/o?vali=1">{t.app.notFound.toOrganisations}</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <p className="text-lg">
        {t.app.invite.joinAs(preview.organisationName, t.roles[preview.role].toLowerCase())}
      </p>
      <p className="mt-2 text-k-muted">{t.roleDescriptions[preview.role]}</p>
      <p className="mt-1 text-sm text-k-muted">{t.app.invitations.validUntil(formatDate(preview.expiresAt))}</p>

      <div className="mt-8">
        {preview.alreadyMember ? (
          <>
            <p className="mb-4">{t.app.invite.alreadyMember}</p>
            {preview.organisationSlug && (
              <Button asChild>
                <Link href={`/o/${preview.organisationSlug}`}>{t.app.invite.open}</Link>
              </Button>
            )}
          </>
        ) : preview.emailMatches ? (
          <AcceptInvitationForm token={token} />
        ) : (
          <p className="border-l-4 border-k-warn bg-k-surface px-4 py-3">
            {t.errors.invitation_email_mismatch}
          </p>
        )}
      </div>
    </>
  );
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <PlainPage>
      <PageHeader title={t.app.invite.title} />
      <Suspense fallback={<LoadingBlock lines={1} />}>
        <Invitation params={params} />
      </Suspense>
    </PlainPage>
  );
}
