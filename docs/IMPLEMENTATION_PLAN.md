# KAIDLY — Implementation plan

Status (2026-10-01): **Phases 1–6 implemented**, plus a committed E2E suite and a review
pass. Work is on branch `phase-2-3-organisations-sites` (based on `phase-1-foundation`);
nothing is merged to `main`. **Phase 7 does not start without explicit approval.**

Each phase ends with a deployable app and every check passing: `npm run lint`,
`typecheck`, `test`, `test:db`, `test:e2e`, `build`.

---

## Done

| Phase | Result | Reference |
|---|---|---|
| 1 Foundation | Clean starter, pinned dependencies, security fixes (redirect allowlist, error codes, fail-closed config), tokens, provisional logo, local Supabase, baseline tests | ARCHITECTURE.md §2 |
| 2 Authentication and organisations | Organisations, roles, members, hashed single-use invitation links, switcher, settings, account | DATABASE.md §4–7 |
| 3 Sites and installations | Sites, installations, archive, identifier unique per site; tabs with placeholders | DATABASE.md §4 |
| 4 Käidupäevik | Append-only log, corrections, organisation and installation logs with filters, mobile entry flow | DATABASE.md §6 |
| 5 Käidukava | One-time and recurring activities, anchored due dates, completion → log entry, derived states | DATABASE.md §8 |
| 6 Puudused | Deficiencies, open ⇄ in progress → resolved, resolution → log entry, never deleted | DATABASE.md §9 |
| Tests | 310 pgTAP, 38 unit, 35 E2E (core flows on phone/tablet/desktop) | DATABASE.md §11, README |
| Reviews | Responsive (375/768/1440), accessibility (axe + keyboard), security regression (+ review gates), code quality | this file, "Review log" |

**Still not final for Phase 3:** the electrical-professional domain review (PRODUCT.md §8).

## Next phases (not started)

### Phase 7 — Documents (recommended plan)
- Migration `documents_storage`:
  - table `documents`: organisation, site and installation composite FKs; optional link to a log entry or deficiency of the same installation; `kind`, `title`, `file_name`, `mime_type`, `size_bytes`; `storage_path` starting with the organisation id (check); uploader snapshot;
  - one **private** bucket `documents`, 25 MB limit, allowed types PDF, JPEG, PNG, WebP, HEIC, DOCX, XLSX (D9);
  - storage policies via `private.path_org_id(name)` → `org_ids('viewer'|'operator'|'admin')`;
  - optional `sites.cover_document_id` (D17).
- **Immutability decision needed before building:** files attached to a log entry are part of the record. Recommendation: they can't be deleted, only marked superseded; other documents can be archived by admins.
- Upload from the browser straight to Storage (no file bytes through Vercel), client-side image resize, progress, retry; attach to a log entry in the entry form (photo while standing at the installation); signed URLs (≈ 5 min) for viewing.
- Pages: installation Dokumendid tab, organisation `/dokumendid`, attachments on log entries and deficiencies.
- pgTAP: cross-tenant path read/write denied, malformed path denied, viewer can't upload, operator can't delete, link consistency. E2E: photo on a log entry from a phone viewport. Extend the baseline (bucket private, exact policy set on `storage.objects`).
- Orphaned uploads (uploaded but never attached): cleanup approach to decide (scheduled function vs. manual) — no background infrastructure exists yet.

### Phase 8 — Dashboard
Overdue/due-soon activities, open deficiencies by severity, latest entries, counts per site;
change history (`activity_history`) for admins on the installation page.

### Phase 9 — Mobile polish
Real-device pass (iOS Safari, Android Chrome; keyboard overlap, camera, slow network), local
drafts for entry forms, marketing page with real photography (D11), Estonian copy review.

### Phase 10 — Production readiness
Separate production Supabase project, push migrations, auth settings and Estonian email
templates, security headers (CSP, HSTS, frame-ancestors), rate limits (sign-up,
organisation creation, invitations), CI running all checks against a local stack,
backups/PITR, privacy (account deletion and data export policy), Supabase advisors clean.

---

## Decisions

All decided 2026-10-01 unless noted.

| # | Decision | Outcome |
|---|---|---|
| D1 | Local database | Supabase CLI in any Docker-compatible runtime; reproducible migrations and automated security tests |
| D2 | Environments | `.env.local` = hosted **development** project; production is created before launch; nothing pushed yet |
| D3 | Operating log | Strictly append-only; corrections are new entries pointing at the original (flat, no chains), newest wins, original preserved |
| D4 | Invitations | Copyable links only; hashed, expiring, single-use tokens bound to email; no email provider |
| D5 | Permissions | DATABASE.md §5 — the matrix as implemented (operators may correct any entry; nobody deletes deficiencies) |
| D6 | Next due date | **Anchored to the schedule** (Phase 5 brief); late completion skips missed occurrences — replaces the earlier "from completion date" |
| D7 | URL language | Estonian segments, English code |
| D8 | Validation | `zod` on the server for every action |
| D9 | Document types | PDF, JPEG, PNG, WebP, HEIC, DOCX, XLSX (Phase 7) |
| D10 | Cache Components | Kept; tenant data is never cached; dev-only "instant" validation logs on `notFound()` are expected |
| D11 | Marketing photography | Real, licensed photos to be supplied; no stock |
| D12 | Sign-up | Open for now; revisit before launch |
| D13 | UI language | Estonian only; strings centralised in `lib/i18n/et.ts` |
| D14 | Tailwind | Stays on v3; no upgrades without a concrete reason |
| D15 | Agent instructions | `CLAUDE.md` only |
| D16–D21 | Brand, cover photos, states, logo, terminology, CTA | DESIGN.md |
| D22 | Installation identifier | Optional; unique within a site (case-insensitive) |
| D23 | Deficiency resolution | Final; recurring problem = new deficiency; never deleted |
| D24 | Completion history | The operating log is the completion history (no separate table) |
| — | Out of scope | No AI, payments, IoT, ERP/EAM integrations, email infrastructure, analytics, notifications |

## Open questions (need a decision or domain review)

1. Installation types, statuses and "responsible person" (käidukorraldaja?) — electrical professional review.
2. Which technical fields are needed (voltage level, main fuse, EIC code, inspection dates) — none added yet.
3. Late completion of periodic activities: is skipping missed occurrences right, or must each missed occurrence be recorded?
4. Should resolved deficiencies be re-openable, or is "new deficiency" the right model?
5. Log entry types and deficiency severity labels — professional review.
6. Retention: how long must records be kept, and what happens to an organisation's data when it leaves? (Organisation deletion is not implemented.)
7. Documents attached to log entries: immutable (recommended) or deletable?

## Risks

| Risk | Mitigation |
|---|---|
| RLS mistake leaks data between customers | Composite FKs, single helper, default-deny privileges, baseline review gates, pgTAP matrix per table, mutation testing, no service-role key in the app |
| Poor signal on site | Short forms, typed values preserved on errors; offline drafts in Phase 9; true offline sync post-MVP |
| Domain model mismatch | Professional review before Phase 3 is final; small enums |
| Regulatory expectations | Append-only log + history; no compliance claims until reviewed |
| Next.js 16 differences | Follow `node_modules/next/dist/docs/` (CLAUDE.md); lessons in ARCHITECTURE.md §6a |
| Local/hosted drift | Same Postgres major (17); migrations only; confirm when linking |
| Scope creep | PRODUCT.md §2 is the filter |

## Review log (2026-10-01)

- **Responsive:** every page at 375, 768 and 1440 px — no horizontal overflow. Fixed: 44 px touch targets (logo links, back links, compact buttons on phones), log-row label wrapping, deficiency actions order, "Märgi tehtuks" only on due items in lists.
- **Accessibility:** axe-core (WCAG 2.1 AA + best practice) on all pages — one issue fixed (paragraph inside a definition list); one `h1` per page and no skipped levels; keyboard pass on the entry form (visible focus everywhere, radio chips reachable); labelled lists.
- **Security:** no secrets in git history; the service key exists only in local test tooling; 17 definer functions reviewed; baseline extended with review gates (exact tables, definer functions and RPCs; tenant policies through `org_ids`; no write paths into append-only tables, including column grants; no public buckets) — all mutation-tested.
- **Code:** duplicate validation-error helpers merged, unused code and strings removed, no `any` or suppressions.
- **Fixed during Phases 4–6:** a stale completion form showed "no access" instead of "already done"; two corrections in one transaction had no defined order (now `clock_timestamp()`); dropdown and field values lost after validation errors (Phase 3 fix, now covered by E2E).
