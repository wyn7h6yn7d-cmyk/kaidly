"use client";

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSiteViewerInvitation } from "@/lib/actions/site-viewers";
import { useT } from "@/lib/i18n/client";

/**
 * Owner/admin invites a site viewer: e-mail + the sites (this one preselected). KAIDLY
 * creates a one-time link; "Saada e-postiga" opens the inviter's own mail program with the
 * prepared text — nothing is sent by KAIDLY.
 */
export function SiteViewerInviteForm({
  orgSlug,
  sites,
  currentSiteId,
}: {
  orgSlug: string;
  sites: { id: string; name: string }[];
  currentSiteId: string;
}) {
  const t = useT();
  const id = useFieldId();
  const copy = t.app.siteViewers;
  const [state, action, pending, value] = useFormAction(createSiteViewerInvitation);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const link = state.data && typeof window !== "undefined" ? `${window.location.origin}/vaataja-kutse/${state.data.token}` : null;
  const copied = copiedToken !== null && copiedToken === state.data?.token;
  const [chosen, setChosen] = useState<Set<string>>(() => new Set([currentSiteId]));

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <Field id={id("viewer-email")} label={copy.email}>
          <Input
            id={id("viewer-email")}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            required
            defaultValue={value("email")}
            aria-invalid={state.fields?.email}
            aria-describedby={`${id("viewer-email")}-hint`}
          />
        </Field>
        <p id={id("viewer-email-hint")} className="-mt-3 text-sm text-k-muted">
          {copy.inviteHint}. {copy.emailHint}
        </p>
        <fieldset aria-invalid={state.fields?.siteIds} className="min-w-0">
          <legend className="text-[15px] font-semibold">{copy.sites}</legend>
          <p className="mt-1 text-sm text-k-muted">{copy.sitesHint}</p>
          <div className="mt-3 flex flex-col gap-1">
            {sites.map((site) => (
              <label key={site.id} className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  name="siteIds"
                  value={site.id}
                  checked={chosen.has(site.id)}
                  onChange={(event) => {
                    const next = new Set(chosen);
                    if (event.target.checked) next.add(site.id);
                    else next.delete(site.id);
                    setChosen(next);
                  }}
                  className="size-5 shrink-0 accent-k-green"
                />
                <span className="min-w-0 break-words">{site.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? copy.submitting : copy.submit}
          </Button>
        </div>
      </form>
      <FormMessage code={state.errorCode} />

      {link && state.data && (
        <section aria-live="polite" className="border-l-4 border-k-volt bg-k-surface p-4 sm:p-5">
          <h3 className="font-bold">{copy.linkTitle}</h3>
          <p className="mt-1 text-sm text-k-muted">{copy.linkBody}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={link} aria-label={copy.linkTitle} onFocus={(e) => e.currentTarget.select()} className="font-mono text-sm" />
            <Button
              type="button"
              variant="dark"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopiedToken(state.data?.token ?? null);
              }}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? copy.copied : copy.copy}
            </Button>
          </div>
          <Button asChild variant="outline" className="mt-3">
            <a
              href={`mailto:${encodeURIComponent(state.data.email)}?subject=${encodeURIComponent(copy.mailSubject)}&body=${encodeURIComponent(copy.mailBody(link))}`}
            >
              <Mail aria-hidden="true" />
              {copy.sendEmail}
            </a>
          </Button>
          <p className="mt-3 text-sm text-k-muted">{t.app.invitations.validUntil(t.fmt.date(state.data.expiresAt))}</p>
        </section>
      )}
    </div>
  );
}
