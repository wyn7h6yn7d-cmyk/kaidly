# KAIDLY — V1 completion and real-world QA report

Date: **2026-10-03** · Branch `phase-2-3-organisations-sites` · Environment for all
destructive and large-data work: the **local** Supabase stack. Development
(`gdpzavhkblbcxivoaqax`) only receives reviewed migrations. Production
(`xakpbtmksxvjmsbipwmj`, "msbi") is not touched by this work.

This report replaces the planned `QA_OVERNIGHT_REPORT.md`: the overnight QA pass and the
V1 completion package were done together.

## 1. Baseline

| | |
|---|---|
| Start HEAD | `7b63dfd` (clean tree; CLI linked to DEVELOPMENT) |
| lint / typecheck / unit | pass / pass / 89 pass |
| pgTAP | 633 in 19 files, pass |
| E2E | the previous full run had hung after 4 failures (below), all fixed first |

Baseline failures found and fixed:

| Test | Cause | Fix |
|---|---|---|
| `layout.spec` 200 % text, 375 px | **Product bug:** the onboarding "blocked" note (`inline-block`) pushed the page 38 px wide | wrapping block (`w-fit max-w-full break-words`); the existing layout test is the regression test |
| `access.spec` urgent banner | test expected the old class after the banner redesign | assertion updated |
| `reports.spec`, `admin.spec` countdowns | fixtures used the database `current_date` (UTC) while the app counts in Tallinn; around Tallinn midnight they differ by a day | fixtures use `(now() at time zone 'Europe/Tallinn')::date` (also in `onboarding`, `search`) |

## 2. Visual and UX changes

- **Hero grid:** checked at 375/768/1440/1920. The engineering grid is visible across the
  hero, calmer behind the headline; tiles are secondary. Left unchanged (no darkening).
- **Overview:** reviewed for a new company (trial banner, onboarding with progress, invite,
  reminder card) and an established one (overdue, due in 14 days, high/critical
  deficiencies, latest entries, sites with open items). It answers "what needs my
  attention" from real data only.
- **Installation page — quick actions** "Lisa sellele paigaldisele": add a deficiency, add
  a plan activity (admins), add a document. Each opens the existing form with the
  installation preselected (`?paigaldis=`). Not shown to viewers, in expired or deactivated
  companies (effective role), or on archived installations. The new-entry button stays in
  the header.
- **Activity completion:** after "Märgi tehtuks" the success line names the next due date
  ("Järgmine tähtaeg: 15.01.2027.") or that a one-time activity is finished. Recurrence
  calculation unchanged.
- **Deficiency resolution:** the intro now also says that a recurring problem becomes a new
  deficiency (resolution stays final; no re-open).
- **Notifications:** an empty state with "Siia ilmuvad lähenevate tähtaegade teavitused."
- **Help:** new topics Aruanded, Otsing, Andmete import, Prooviperioodi lõpp (in addition to
  Objekt, Elektripaigaldis, Käidupäevik, Käidukava, Puudus, Dokument and reminders).
- **Long names:** the quick-entry list overflowed at 375 px with a 120-character unbroken
  installation name (found with the performance dataset) — fixed.

## 3. Context and navigation

Create flows already keep context: from an installation, "Lisa puudus", "Lisa tegevus",
"Lisa dokument" and the log entry open with the installation (and so the site and company)
preselected; the selector stays changeable where the rules allow it. Deep pages show
company / site · installation in the header eyebrow with a back link; mobile uses the same
back pattern. No further breadcrumbs were added.

## 4. CSV import (v1)

Architecture: browser parsing and preview → Server Action → `import_company_data`
(security definer, authoritative). Details: DATABASE.md §5g, ARCHITECTURE.md §6c2.

| | |
|---|---|
| Where | Seaded → **Andmete import** (`/o/<org>/seaded/import`), owners and admins |
| Scope | sites; electrical installations. **Not**: log history, deficiency history, documents, users, memberships. Scheduled activities: post-v1 (needs recurrence mapping) |
| Templates | `/templates/kaidly-objektid.csv`, `/templates/kaidly-elektripaigaldised.csv` (UTF-8 with BOM, English column keys explained in the UI, installation types listed with translations) |
| Wizard | choose type → upload → preview table with per-row reasons → confirm → result |
| Validation | required name/site, duplicate rows, duplicate identifier per site, existing identifier, existing site name, unknown site, ambiguous site, type, `YYYY-MM-DD` dates (impossible dates refused), lengths, formula-like values (`=`, `@`) |
| Atomicity | all rows or none; the button exists only when every row is valid |
| Duplicates | exact constraints only; repeated submit with the same token returns the first result |
| Security | role and access from `org_ids('admin')`; sites matched by name inside the company (no ids from the client); expired: preview only; deactivated: refused; anon: no execute |
| File safety | 1 MB, 1000 rows, 30 columns, strict UTF-8, RFC 4180 quoting, `,`/`;` detection (technical limits, not quotas) |
| Provenance | `private.import_batches` (kind, count, created ids, user, time; no file contents) |
| Error recovery | network failure → "Ühendus katkes … proovi uuesti: sama faili ei impordita kaks korda"; database refusal → "Rida N: … Midagi ei imporditud." |

Tests: 34 pgTAP (`180_company_import`, mutation-tested), 6 unit (parser/validation),
E2E `import.spec` (owner flow on desktop/tablet/mobile incl. axe, invalid rows, operator,
expired company).

## 5. QA fixture tooling

`npm run qa:fixtures [-- --perf]` (README "QA fixtures"). Local only:
`scripts/qa-guard.mjs` aborts on the production ref in any environment variable or the CLI
link and on any non-localhost target (unit-tested); rows are written inside the local DB
container. Removal: `npm run db:reset`. No hosted variant exists, so the guard can't be
bypassed by an ordinary invocation.

| Company | State | Content |
|---|---|---|
| QA Elektritööd OÜ | trial, 5 days left | 2 sites, 6 installations, 34 log entries (incl. corrections, one with two), 10 activities at 30/14/7/1/0/−1/−15/45/60/90 days, 5 deficiencies (all severities/states, one resolved with log entry), 4 document rows, reminders |
| QA Tööstuspark OÜ | active (full access, invoice ref) | 8 sites, 24 installations, 160 log entries, 42 activities, 20 deficiencies, 30 document rows, 44 reminders |
| QA Haldus OÜ | expired | 1 site/installation/entry; the multi-company user is a viewer |
| QA Suletud OÜ | deactivated, with history | 1 site/installation/entry |
| QA Jõudlus … OÜ (`--perf`) | trial | 30 sites, 150 installations, 2000 log entries, 500 activities, 300 deficiencies, 500 document rows, 268 reminders; extreme-length name/address/description/title |

Accounts (password `kaidly-qa-parool`): owner, operator, viewer, Tööstuspark owner/admin/
operator, **multi-company** (owner in Elektritööd, operator in Tööstuspark, viewer in
Haldus), a user without company, a local platform admin.

## 6. Role matrix (verified)

Sources: pgTAP role tests per table/RPC, E2E per module, and a browser pass over every
company page as owner, operator and viewer of the same company.

| Area | Owner | Admin | Operator | Viewer |
|---|---|---|---|---|
| Sites, installations | create/edit/archive | create/edit/archive | read | read |
| Operating log | add, correct | add, correct | add, correct | read |
| Plan | create/edit/archive, complete | same | complete | read |
| Deficiencies | create/edit/resolve | same | same | read |
| Documents | all general + attachments | same | installation docs, attachments | read, download |
| Reports, search | yes | yes | yes | yes |
| Notifications | yes | yes | yes | none (by design) |
| Invitations, members | all roles | not owner | — | — |
| Company settings | edit | edit | read | read |
| **Import** | yes | yes | no (page: "no access") | no |
| Lifecycle (deactivate, delete) | yes | — | — | — |

No discrepancies found.

## 7. Access matrix (verified)

| State | UI | Database writes | Search / reports | Notifications | Onboarding | Import |
|---|---|---|---|---|---|---|
| Trial | full, banner with days left (urgent last 3 days) | allowed | yes | generated | guide | allowed |
| Active | full, no trial banner | allowed | yes | generated | guide | allowed |
| Expired | read-only notice, write buttons hidden | refused (`org_ids`) | yes (read + download) | not generated | blocked step names the ended trial | preview only, import refused (`company_read_only`) |
| Deactivated | single "deactivated" notice | refused | excluded | none | — | refused |

The multi-company user sees each company in its own state in the same session (switcher,
search, notifications).

## 8. Mobile (320–430) and desktop (1440–1920)

A browser pass over 507 page loads (8 roles × all company, settings, import, search,
notification, account and admin pages; 375/1440/1920 px): no horizontal overflow (after
the quick-entry fix), no error pages, no unexpected status codes; the not-found pages seen
were all correct cross-company denials. The layout suite covers 320–1440 px and 200 % text;
the new import wizard runs on phone and tablet in E2E. Desktop: content stays within
`--k-max-app` (92 rem); tables use the width, forms stay narrow.

## 9. Workflows

- **Maintenance** (quarterly task, reminders 30/14/7/1, late completion, history, next date,
  notification, plan report): covered by `schedule`, `notifications`, `reports` E2E and the
  fixture data; the completion message now shows the next date.
- **Fault** (deficiency → photo → log entry → due date → in progress → resolved → report):
  `deficiencies`, `mobile-workflows`, `reports` E2E on phone and desktop.
- **Audit** ("what happened on this installation in the last year"): installation log with
  corrections, plan completions, deficiencies and documents tabs, and the installation
  report (PDF/CSV) with period filters answer it. Future: a single combined timeline per
  installation (post-v1 idea, not blocking).
- **New customer with an Excel list:** create company → import sites → import installations
  → first log entry → plan → document — done in E2E (import) plus the existing flows.
  Friction found: none blocking; the installations import needs the sites first, which the
  UI says.

## 10. Large dataset (local)

All pages of the performance company respond within ~1.5 s in **dev mode** (no N+1; lists
paginated; search groups limited; reports bounded). No issue demonstrated beyond the long
name overflow (fixed). Next 16 dev logs "runtime data during prerendering" advisories for
authenticated routes — advisory about instant navigation, not an error (post-v1 X).

## 11. Security

| Attempt | Result |
|---|---|
| Cross-tenant URL substitution (company, site, installation, entry, deficiency, document) | not found (pgTAP oracles + E2E + browser pass) |
| Import into a foreign company / forged site / anon / viewer / operator / expired / deactivated | refused (pgTAP) |
| Foreign notification ids | user-scoped RLS (pgTAP `140`) |
| Foreign report filters | filters validated against the user's RLS data (E2E `reports`) |
| Storage | signed URLs only after the access-checked route (pgTAP `080`, E2E `documents`) |
| `/admin` as a company owner | not found (E2E `admin`, browser pass) |
| Unsaved drafts on a shared device | **fixed:** sign-out now clears this tab's drafts (E2E) |

## 12. Double submit / idempotency

Import: token (pgTAP). Log save, completion, resolution: buttons disabled while pending;
completion has `activity_already_completed`, resolution `deficiency_already_resolved`
(pgTAP); reminders unique per (user, activity, occurrence, threshold, channel); document
finalize is idempotent (pgTAP `080`).

## 13. Localisation and copy

All new strings in ET/EN/RU with identical keys (unit test). Estonian uses "ettevõte" in
new copy; Russian keeps the existing "организация" terminology; English "company"/
"organisation" as before. Russian wording still needs the planned native review.

## 14. Accessibility

axe (WCAG 2.1 A/AA) on the import page and on the wizard with a parsed file and with
validation errors; preview table with caption and column headers; radio group with legend;
file input labelled with its hint; status/alert roles for results and errors. Existing
sweeps cover quick actions (installation page), onboarding, notifications, reports, scroll-
to-top.

## 15. Migrations

`20261003100000_company_import.sql` (new; no applied migration edited). Applied: local.
Development: see §17. Production: not in this package.

## 16. Remaining v1 issues

None blocking. Pre-launch manual items unchanged (RELEASE_CHECKLIST.md): legal operator
facts TBA, SMTP, mailbox, backups, email templates, optional uptime monitor.

## 17. Verification and sync

Filled in after the final clean run (see the end of this file).
