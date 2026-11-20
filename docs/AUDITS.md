# KAIDLY — Periodic audits and the audit package

Owner decision 2026-11-20 (item g). Migration `20261121200000_installation_audits.sql`.
Tests: `supabase/tests/260_installation_audits.test.sql`, `tests/unit/audit-package.test.ts`
(builds the PDF from sample data and checks all six parts), `e2e/audits.spec.ts`.

## Audit data on an installation

- **Viimane korraline audit** — the latest row of `public.installation_audits` (date, result,
  auditing body, optional https document link, who added it). Append-only: a mistake is fixed by
  recording the audit again. Recorded by owners/admins; read by members and the site's viewers.
- **Järgmise korralise auditi tähtaeg** — a scheduled activity with `kind = 'periodic_audit'`
  (one live per installation, `reminder_days = {90,30}`). It therefore appears in the operating
  plan, uses the one countdown implementation, the bell and the optional e-mail reminder.
- The site page (and the viewer's page) shows the nearest audit deadline with the countdown.

## Auditipakett ("Kokkuvõte audiitorile")

Button on the site page (members) and on `/vaade/[site]` (site viewers). One PDF, generated on
request through the user's own session, never stored:

1. Cover: site, installations, operations manager (the site's responsible person), company,
   period start and end, date generated.
2. Current operating plan with deadlines.
3. Operating log of the period; each correction right after its original (originals of
   corrections in the period are included even if older).
4. Deficiencies, open and closed: severity, status, due date, resolution.
5. Documents with links, plus the photo links of log entries and deficiencies.
6. Last audit per installation and the next deadline.

Default period: from the earliest of the installations' latest audits (so every installation is
covered since its last audit); without audits, 12 months back; ends today. The PDF and the page
make no claim of matching any official (TTJA) form — unit-tested.

Routes: `/o/[org]/objektid/[site]/auditipakett` (form), `…/auditipakett/pdf?alates=&kuni=`,
`/vaade/[site]/auditipakett`.
