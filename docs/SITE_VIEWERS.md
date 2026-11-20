# KAIDLY — Objekti vaataja (site viewer)

Owner decision 2026-11-20. Migration `20261120200000_site_viewers.sql`. Tests:
`supabase/tests/240_site_viewers.test.sql`, `supabase/tests/000_security_baseline.test.sql`,
`e2e/site-viewers.spec.ts`, `tests/unit/plans.test.ts`.

## What it is

A read-only person — e.g. the owner of a site or the board of an apartment association —
invited by a company **owner or admin** to one or more specific **sites**. Not a company
member: no `organisation_members` row and no company role.

A viewer sees, for their sites only: installations, operating-plan deadlines (with the
countdown), the operating log (incl. corrections and who wrote them), open and closed
deficiencies, and the site's/installations' **document links** (no company-level documents,
no stored files, nothing archived). They can download the site PDF report. They cannot add,
change or delete anything; they never see other sites, the company's settings, members,
invitations, notifications, search or change history.

**Unpaid or inactive company → the viewer sees nothing** (owner decision): access requires
the company not deactivated and commercially active (trial or paid, `private.can_company_write`).

## Model

| Table | Purpose |
|---|---|
| `public.site_viewers` | grants (user × site), `revoked_at`/`revoked_by`; rows are never deleted (trace) |
| `public.site_viewer_invitations` | link invitations (sha256 of the token only), 7 days, one live per e-mail per company |
| `public.site_viewer_invitation_sites` | the sites an invitation covers (1–50, the company's own) |
| `private.plan_settings` | `site_viewers_count_as_users` (default **false**) — mirrored in `lib/plans.ts` (`SITE_VIEWERS_COUNT_AS_USERS`), unit-tested equal |

## Access control

- **Database (primary).** `private.viewer_site_ids()` = the caller's sites with an active grant,
  a live session, company not deactivated and `can_company_write`. SELECT-only policies through it
  on `sites`, `electrical_installations`, `scheduled_activities`, `log_entries`, `deficiencies`,
  `documents` (links only). There is **no** insert/update/delete policy for viewers; every write
  RPC requires membership. The security baseline pins that viewer policies are SELECT-only.
- **RPCs.** `create_site_viewer_invitation` (owner/admin of a writable company, own sites, not a
  member's e-mail), `site_viewer_invitation_preview`, `accept_site_viewer_invitation` (same
  confirmed e-mail, live session, once), `revoke_site_viewer`, `revoke_site_viewer_invitation`
  (owner/admin), `site_viewers_overview` (owner/admin: names/e-mails of viewers of a site),
  `my_site_access` (the viewer's company and site names only).
- **Revocation is immediate:** RLS evaluates `viewer_site_ids()` on every query.
- **Server.** Viewer pages (`/vaade`, `/vaade/[site]`, `/vaade/[site]/aruanne`) resolve the site
  from `my_site_access()`; anything else is the ordinary not-found. No viewer Server Actions write.

## Seats

Viewers do **not** count towards the plan's users. To change that, set both
`private.plan_settings.site_viewers_count_as_users` (new migration) and
`SITE_VIEWERS_COUNT_AS_USERS` in `lib/plans.ts`; `private.seats_used()` then adds active viewers
(who are not members) and live viewer invitations, and new viewer invitations check the limit.

## Invitations and e-mail

Like member invitations: KAIDLY creates a one-time link (shown once). "Saada e-postiga" opens the
inviter's own mail program with a prepared text — KAIDLY/Resend sends nothing for this.
The invited person signs in or signs up with the invited e-mail at `/vaataja-kutse/[token]`.
