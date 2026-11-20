import { ConfirmForm } from "@/components/forms/confirm-form";
import { revokeSiteViewer, revokeSiteViewerInvitation } from "@/lib/actions/site-viewers";
import { getSiteViewersOverview } from "@/lib/data/site-viewers";
import { getT } from "@/lib/i18n/server";
import { SiteViewerInviteForm } from "./site-viewer-invite-form";

/** "Objekti vaatajad" on a site page — owners and admins only (the RPC checks again). */
export async function SiteViewersPanel({
  orgSlug,
  siteId,
  sites,
  writable,
}: {
  orgSlug: string;
  siteId: string;
  sites: { id: string; name: string }[];
  writable: boolean;
}) {
  const t = await getT();
  const copy = t.app.siteViewers;
  const overview = await getSiteViewersOverview(siteId);
  if (!overview) return null;

  return (
    <section aria-labelledby="site-viewers" className="mt-12" data-testid="site-viewers">
      <h2 id="site-viewers" className="text-xl font-bold">
        {copy.title}
      </h2>
      <p className="mt-2 max-w-3xl text-k-muted">{copy.intro}</p>
      <p className="mt-1 text-sm text-k-muted">{copy.seatsNote}</p>

      {overview.viewers.length === 0 ? (
        <p className="mt-4 text-k-muted">{copy.empty}</p>
      ) : (
        <ul aria-label={copy.listLabel} className="mt-4 divide-y divide-k-line border border-k-line bg-k-surface">
          {overview.viewers.map((v) => {
            const who = v.name || v.email || "";
            return (
              <li key={v.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="min-w-0">
                  <span className="block break-words font-semibold">{who}</span>
                  <span className="block break-words text-sm text-k-muted">
                    {[v.name ? v.email : null, copy.since(t.fmt.date(v.since))].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <ConfirmForm
                  action={revokeSiteViewer}
                  fields={{ orgSlug, viewerId: v.id }}
                  confirm={copy.revokeConfirm(who)}
                  label={copy.revoke}
                  ariaLabel={`${copy.revoke}: ${who}`}
                />
              </li>
            );
          })}
        </ul>
      )}

      {overview.invitations.length > 0 && (
        <div className="mt-6">
          <h3 className="font-bold">{copy.pendingTitle}</h3>
          <ul className="mt-2 divide-y divide-k-line border border-k-line bg-k-surface">
            {overview.invitations.map((i) => (
              <li key={i.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="min-w-0 break-words">
                  {i.email} <span className="text-sm text-k-muted">· {copy.expires(t.fmt.date(i.expiresAt))}</span>
                </span>
                <ConfirmForm
                  action={revokeSiteViewerInvitation}
                  fields={{ orgSlug, invitationId: i.id }}
                  confirm={copy.cancelConfirm(i.email)}
                  label={copy.cancel}
                  ariaLabel={`${copy.cancel}: ${i.email}`}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {writable && (
        <div className="mt-8 max-w-2xl">
          <h3 className="mb-4 font-bold">{copy.inviteTitle}</h3>
          <SiteViewerInviteForm orgSlug={orgSlug} sites={sites} currentSiteId={siteId} />
        </div>
      )}
    </section>
  );
}
