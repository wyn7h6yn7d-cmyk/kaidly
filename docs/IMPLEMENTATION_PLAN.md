# KAIDLY — Implementation plan

Status: **approved 2026-10-01.** Phase 1 done. Phases 2–3 implemented on branch
`phase-2-3-organisations-sites`. Phase 4 does not start until approved.

Each phase ends with a working, deployable app and `npm run check` passing (lint,
typecheck, unit tests, pgTAP database tests, build). Each phase is one or more commits on
a branch, merged to `main` after review.

---

## Phase 1 — Foundation ✅ done

Clean starter, tooling, design tokens, database foundation. No product modules.

- [x] Remove tutorial/demo components, `/protected`, deploy button, logos, `next-themes` / theme switcher, starter images, unused primitives.
- [x] Fix starter security issues (ARCHITECTURE.md §2): open redirect → allowlist; user-controlled error text → error codes; fail-open configuration → fail closed; explicit public-route list.
- [x] Pin every dependency exactly; `.npmrc` save-exact; `.nvmrc`; Supabase CLI as pinned dev dependency; ESLint ignores generated folders; Tailwind `require()` fixed; `typecheck`, `test`, `test:db`, `db:*`, `check` scripts.
- [x] `lang="et"`, metadata, Inter + Manrope via `next/font`, brand tokens in `globals.css` + `tailwind.config.ts`, restyled primitives (button, input, label, dropdown).
- [x] Provisional logo and app icon (D19).
- [x] App shell: desktop sidebar / mobile top bar + bottom tab bar, account menu; navigation disabled until an organisation exists (Phase 2).
- [x] `lib/i18n` (`t`, `Messages` type) with all strings in `et.ts`; Estonian auth screens; sign-up collects the user's name.
- [x] `supabase init` + local config; migration `foundation`: default-privilege lockdown, `private` schema, shared triggers, `profiles` + auth triggers.
- [x] Generated database types; pgTAP security baseline + foundation tests; unit tests for the security fixes.
- [x] `AGENTS.md` removed; `CLAUDE.md` is the single source of agent instructions.
- [x] README rewritten.
- [ ] **Manual:** link the hosted development project and push the foundation migration (README → "Hosted development project").

Moved to Phase 2 (they depend on `organisations`): `org_role` enum, `role_rank`, `org_ids`,
`activity_history` + `record_history`.

## Phase 2 — Authentication and organisations ✅ implemented

As built: see DATABASE.md §9. Deferred: organisation deletion (needs the Phase 4 append-only
exception), email change.


- Migration `organisations`: `org_role`, `private.role_rank`, `private.org_ids`, `organisations`, `organisation_members`, `organisation_invitations` (hashed tokens), `activity_history` + `record_history`, `protect_last_owner`; RPCs `create_organisation`, `create_invitation`, `invitation_preview`, `accept_invitation`, `delete_organisation`; profiles visible to co-members.
- `zod` added for Server Action validation.
- `/o` (list / redirect), `/o/uus` (create), `/o/[org]` layout with `requireMembership`, organisation switcher; shell navigation enabled.
- `/o/[org]/seaded` (owner) and `/seaded/liikmed` (admin+): members, change role, remove, invite (copyable link shown once), revoke invitation.
- `/invite/[token]` (added to the proxy's public routes and the redirect allowlist); pending invitations shown after login.
- `/konto`: name, phone, password, sign out, leave organisation.
- pgTAP: full matrix for the three tables + RPCs; cross-tenant isolation; last-owner protection; admin can't grant/remove owner; token hash only, expiry, single use, revocation, wrong-email rejection.

**Done when:** two users in two organisations cannot see each other's organisation in any way (tested), and one user in two organisations can switch between them.

## Phase 3 — Sites and electrical installations ✅ implemented (domain review pending)

As built: see DATABASE.md §10. Routes: `/o/[org]/objektid`, `/objektid/uus`,
`/objektid/[site]`, `/objektid/[site]/muuda`, `/paigaldised/uus`, `/paigaldised/[installation]`
(+ `/muuda` and placeholder tabs `paevik`, `kaidukava`, `puudused`, `dokumendid`).
Phase 3 is not final until the domain review below is done.


- **Domain review** of installation fields, kinds and voltage levels with a practising electrical operations professional. Phase 3 is not final until this review is done.
- Migration `sites_installations` with composite FKs, indexes, RLS (admin+ write, operator read-only), history triggers.
- Sites list / create / edit / archive; site page with its installations.
- Installation create / edit / archive; installation page with tabs Käidupäevik · Käidukava · Puudused · Dokumendid · Andmed (Andmed filled, others empty states).
- pgTAP: matrix (operators cannot create/archive), composite-FK test (can't attach an installation to another org's site).

**Done when:** an admin can model a real customer (several sites, several installations each) on a phone.

## Phase 4 — Operating log (käidupäevik) ✅ implemented

As built: DATABASE.md §11. Routes `/o/[org]/paevik` (filters: site, installation, type, date
range) and `/o/[org]/paigaldised/[installation]/paevik` (+ `/uus`, `/[entry]`, `/[entry]/paranda`).
Permissions follow the approved brief: operators may correct any entry (not only their own).


The most important phase.

- Migration `log_entries`: strictly append-only (no update/delete policies + blocking trigger), correction entries pointing at the original with a mandatory reason, author snapshot, time check, `log_entries_current` view.
- Installation → Käidupäevik tab: current state of each entry, newest first, paginated; corrected entries marked "Parandatud", with the full history (original + corrections) on the entry page.
- "Lisa sissekanne" flow exactly as in DESIGN.md §6 (installation picker with recents, type chips, auto-focus, local draft, time override). Photos come with Phase 7 storage; the form leaves a place for them.
- Correction flow ("Paranda sissekannet") for the author or admin+.
- Organisation-wide log `/o/[org]/paevik` with filters.
- pgTAP: operator can insert, viewer can't; nobody (including owners and security definer paths) can update or delete; corrections can't target corrections or another installation; only author/admin can correct.

**Done when:** on a phone, from cold start, a routine entry takes ≤ 3 taps to reach typing and ≤ 30 s to save.

## Phase 5 — Scheduled activities (käidukava)

- Migration `scheduled_activities` + RPC `complete_scheduled_activity`. No stored status.
- Installation → Käidukava tab; create / edit / archive (admin+).
- "Tehtud" action (operator+) → pre-filled log entry form → completes and advances the due date from the completion date.
- Organisation-wide `/kaidukava` grouped by derived state: Hilinenud · Tähtaeg läheneb · Tulemas · Tehtud.
- pgTAP: role matrix; operator can complete but not edit; RPC advances dates correctly for day/week/month/year and month-end edge cases (31 Jan + 1 month).

## Phase 6 — Deficiencies (puudused)

- Migration `deficiencies` (status `open` / `in_progress` / `resolved`) + RPC `resolve_deficiency`.
- Create from an installation or from the log-entry form ("Leidsin puuduse").
- Installation → Puudused tab; organisation-wide `/puudused` sorted by severity and due date; filter by status.
- Mark in progress; resolve with a note → linked log entry; reopen (admin+).
- pgTAP: role matrix, resolve writes a log entry, status/resolved_at consistency.

## Phase 7 — Documents

- Migration `documents_storage`: table, private bucket, storage policies, `path_org_id`; optional `sites.cover_document_id` (D17).
- Upload component: camera + files, client-side image resize, progress, retry.
- Attach to site, installation, log entry (added to the Phase 4 form), deficiency; optional site cover photo.
- Installation → Dokumendid tab; organisation-wide `/dokumendid`; view via signed URL; delete and edit metadata (admin+).
- pgTAP + storage tests: cross-org path upload/read denied, malformed path denied, viewer can't upload, operator can't delete.

## Phase 8 — Dashboard

- `/o/[org]`: overdue and due-soon activities, open/in-progress deficiencies by severity, latest 10 entries, counts per site.
- All queries indexed; one round-trip per section, each behind its own `<Suspense>`.
- Change history (`activity_history`) for admins on installation → Andmed. Not a navigation item.

## Phase 9 — Mobile UX and polish

- Real-device pass (iOS Safari, Android Chrome): keyboard overlap, camera capture, safe areas, slow-3G throttling.
- Skeletons, empty states, error states, toasts — consistent everywhere.
- Accessibility pass: keyboard navigation, focus rings, labels, contrast, screen reader on the critical flow.
- Marketing landing page with real photography (if sourced) and the brand board applied.
- Copy review in Estonian.

## Phase 10 — Security review, tests, production readiness

- Full review of every policy, RPC and storage rule against DATABASE.md; re-run all pgTAP tests.
- Supabase security & performance advisors clean (no tables without RLS, no mutable `search_path`, indexed FKs).
- Playwright end-to-end test of the critical flow; GitHub Actions running `npm run check` with a local Supabase stack.
- Orphaned-upload cleanup; auth rate limits; password policy; Estonian auth email templates (Supabase's own mailer — no email infrastructure of our own).
- Security headers (CSP, HSTS, frame-ancestors, referrer policy) in `next.config.ts`.
- Separate production Supabase project, backups (PITR) confirmed, Vercel production env, custom domain, auth redirect URLs.
- Privacy: account deletion flow, data export of an organisation (CSV) if required by customers, privacy notice.

---

## Decisions

All decided 2026-10-01.

| # | Decision | Outcome |
|---|---|---|
| D1 | Local database | Local Supabase via the Supabase CLI in **any Docker-compatible runtime**; no runtime-specific assumptions. Reproducible migrations (`db reset`) and automated RLS/security tests (`test:db`). |
| D2 | Environments | The project in `.env.local` is **DEVELOPMENT**. Production is a separate project created before launch; no production infrastructure yet. |
| D3 | Operating log | **Strictly append-only.** Corrections are new entries linked to the original, with a reason; corrected state is shown clearly and the full original history is preserved. |
| D4 | Invitations | **Copyable links only**, no email provider. Tokens stored **hashed**, expire, single-use, resolve organisation + role from the database, invalid after acceptance or revocation. |
| D5 | Permissions | Owner: full control incl. organisation settings and ownership. Admin: sites, installations, operational data, documents, members except ownership-sensitive actions. Operator: log entries, complete activities, create/update deficiencies, upload documents; no site/installation create/archive/delete, no member management. Viewer: read-only. |
| D6 | Next due date | From the completion date. |
| D7 | URL language | Estonian segments, English code. |
| D8 | Validation | `zod`, added with the first Server Action (Phase 2). |
| D9 | Document types | PDF, JPEG, PNG, WebP, HEIC, DOCX, XLSX. |
| D10 | Cache Components | Kept; tenant data never cached. |
| D11 | Marketing photography | To be supplied/licensed; no stock imagery meanwhile. |
| D12 | Sign-up | Open sign-up for now; revisit before launch. |
| D13 | UI language | Estonian only; strings structured for adding English later. |
| D14 | Tailwind | Stay on the current major version (3). No framework/library upgrades without a concrete issue. |
| D15 | Agent instructions | `CLAUDE.md` only; `AGENTS.md` removed, regeneration disabled. |
| D16 | Brand board | `design/KAIDLY-brand-board.png`. |
| D17 | Site cover photos | Yes, optional, in Phase 7 with Storage. |
| D18 | Activity / deficiency states | Activities: derived Upcoming / Due soon / Overdue / Completed, no "in progress". Deficiencies: Open / In progress / Resolved. |
| D19 | Logo | Provisional SVG placeholder, clearly marked; no logo design work. |
| D20 | Terminology | Primary nav Käidupäevik, Käidukava, Puudused, Dokumendid; action "Lisa sissekanne"; "Tegevused" only inside Käidukava; no "Auditijälg" nav item. Positioning: "Elektripaigaldise käit. Lihtsalt." |
| D21 | "Alusta tasuta" CTA | "Loo konto" until pricing exists. |
| — | Out of scope | No AI, payments, IoT, EAM/ERP integrations or email infrastructure. |
| — | Dependencies | Pinned for reproducible installs; no casual upgrades. |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| RLS mistake leaks data between customers | Severe — trust-ending | Composite FKs, single helper function, default-deny privileges, schema-wide baseline tests, pgTAP matrix for every table, no service-role key in the app, Phase 10 review. |
| Poor signal on site (basements, substations) | Lost entries, frustration | Local drafts, early background uploads, clear retry. True offline sync deliberately post-MVP. |
| Domain model doesn't match how electrical operations professionals work | Rework | Professional review of fields and entry types before Phase 3 is final; keep enums small. |
| Regulatory expectations (record keeping, signatures) | Product can't be used for audits | Append-only log + full history from day one; don't claim compliance until reviewed. |
| Next.js 16 is newer than most references | Wrong patterns copied from older docs | Follow `node_modules/next/dist/docs/` (CLAUDE.md). |
| Local and hosted Postgres versions drift | Migrations behave differently | `supabase/config.toml` uses Postgres 17; confirm the hosted project's version when linking (README). |
| Scope creep toward CMMS/EAM | Product loses its simplicity | PRODUCT.md §2 is the filter; new features need a written reason. |
