import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { LoadingBlock } from "@/components/app/states";
import { AcceptSiteViewerInvitationForm } from "@/components/site-viewers/accept-form";
import { Button } from "@/components/ui/button";
import { previewSiteViewerInvitation } from "@/lib/data/site-viewers";
import { getT } from "@/lib/i18n/server";

// Reads request data (session, language cookie, params): allowed to block on navigation
// instead of claiming an instant static shell (Next 16.4 instant validation).
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.viewerInvite.title, referrer: "no-referrer" };
}

const STATUS_ERROR = {
  invalid: "invitation_invalid",
  expired: "invitation_expired",
  used: "invitation_used",
  revoked: "invitation_revoked",
} as const;

// Requires a session (the proxy sends anonymous visitors to login with ?next=…). Company and
// site names are shown only for a live invitation (site_viewer_invitation_preview).
async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const t = await getT();
  const { token } = await params;
  const preview = await previewSiteViewerInvitation(token);
  const copy = t.app.viewerInvite;

  if (preview.status !== "valid") {
    return (
      <>
        <p className="text-lg">{t.errors[STATUS_ERROR[preview.status]]}</p>
        <Button asChild variant="outline" className="mt-8">
          <Link href="/vaade">{t.app.viewer.title}</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <p className="text-lg">{copy.intro(preview.organisationName)}</p>
      <ul className="mt-3 list-disc pl-6 text-lg">
        {preview.sites.map((name) => (
          <li key={name} className="break-words">
            {name}
          </li>
        ))}
      </ul>
      <p className="mt-4 max-w-2xl text-k-muted">{copy.body}</p>
      <p className="mt-1 text-sm text-k-muted">{t.app.invitations.validUntil(t.fmt.date(preview.expiresAt))}</p>
      <div className="mt-8">
        {preview.emailMatches ? (
          <AcceptSiteViewerInvitationForm token={token} />
        ) : (
          <p className="border-l-4 border-k-warn bg-k-surface px-4 py-3">{t.errors.invitation_email_mismatch}</p>
        )}
      </div>
    </>
  );
}

export default async function SiteViewerInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const t = await getT();
  return (
    <PlainPage>
      <PageHeader title={t.app.viewerInvite.title} />
      <Suspense fallback={<LoadingBlock lines={1} />}>
        <Invitation params={params} />
      </Suspense>
    </PlainPage>
  );
}
