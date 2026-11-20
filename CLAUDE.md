# KAIDLY

This file is the single source of project-level agent instructions. (`AGENTS.md` was
removed and `agentRules: false` in `next.config.ts` stops `next dev` from re-creating it.)

Digital operations logbook for electrical installations — *"Elektripaigaldise käit. Lihtsalt."*

Read before working:
- [docs/PRODUCT.md](docs/PRODUCT.md) — what it is and is not
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stack, structure, data access, routes
- [docs/DATABASE.md](docs/DATABASE.md) — schema, RLS, storage, migrations
- [docs/DESIGN.md](docs/DESIGN.md) — visual direction and mobile UX
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — phases and open decisions

Work one phase at a time. Don't start a phase that hasn't been approved.

## Omaniku töökord ja sisureeglid (kehtivad alates 2026-11-20, on ülimuslikud)

- Enne iga muudatust näita plaani ja oota omaniku kinnitust.
- Iga tekstimuudatus tehakse kõigis kolmes keeles (et, en, ru). Eesti tekst on alus. Inglise
  ja vene tõlke juurde lisa koodikommentaar `// TÕLGE ÜLE VAADATA`, kuni omanik on need kinnitanud.
- Ära lisa väljamõeldud andmeid: kliendiarvamusi, kliendilogosid, kasutajate arvu, statistikat
  ega silte nagu "kõige populaarsem".
- Õiguslikud väited kirjuta täpselt omaniku antud sõnastuses, ära neid laienda.
- Ära väida veebilehel funktsiooni kohta, mida rakenduses veel pole.
- Ära lisa uusi sõltuvusi ilma omanikult küsimata.
- Pärast muudatust käivita build ja testid ning anna lühike kokkuvõte: mida muutsid ja mida
  omanik peab ise brauseris kontrollima.

## Ootel tööd

- **Next 16.4 "blocking-prerender-runtime" hoiatus** (`npm run dev`, ~30 marsruuti, nt `/`,
  `/o/[org]`, `/auth/login`): `getT()`/`cookies()`/`params` loetakse väljaspool `<Suspense>`.
  Build ja testid on rohelised; parandus (Suspense või `export const instant = false`) tehakse
  omaniku otsusel **pärast punkti g** (audit ja auditipakett), eraldi plaaniga.

## Ülevaade (seis 2026-11-20)

1. **Tehnoloogiapinu.** Next.js 16 (App Router, Turbopack, `proxy.ts`), React 19, TypeScript,
   Tailwind 3 + Radix/shadcn, lucide-react ikoonid. Andmebaas: Supabase Postgres (RLS, pg_cron).
   Autentimine: Supabase Auth (e-post + parool, `@supabase/ssr` küpsised). Hosting: Vercel
   (`main` → Production + PRODUCTION Supabase; harud → Preview + DEVELOPMENT Supabase). E-post:
   Supabase Auth mallid + Resend SMTP. **Makseintegratsiooni pole** (teadlikult väljas);
   paketid ja tasulised perioodid määrab platvormi admin käsitsi (`/admin/tellimused`).
2. **Avaleht, hinnad, tõlked.** Avaleht `app/page.tsx` + `components/marketing/*`; hinnatabel
   `components/marketing/pricing.tsx` (`#hinnad`). Paketinumbrid: `lib/plans.ts` (kuvamine) ja
   `private.subscription_plans` (jõustamine); `tests/unit/plans.test.ts` hoiab need võrdsed.
   Tõlked: `lib/i18n/et.ts` (alus), `en.ts`, `ru.ts` sama kujuga; keel tuleb küpsisest
   `kaidly_locale` (vaikimisi et), URL keelega ei muutu. Õiguslehed: `lib/legal/content.ts` +
   `lib/legal/operator.ts`. Admin-konsool ainult eesti keeles (`lib/admin/strings.ts`).
3. **Paketipiirangud** on jõustatud andmebaasis: `private.organisation_access.user_limit` /
   `installation_limit`, lukustavad BEFORE-triggerid `invitation_seat_limit`,
   `organisation_member_before_insert`, `installation_plan_limit` (migratsioon
   `20261007100000_subscription_plans.sql`). Kasutajad = kõik liikmed + ootel kutsed
   (`private.seats_used`); arhiveeritud paigaldisi ei loeta. Prooviperiood on isiklik
   (`private.user_trials`). `null` = piiranguta (vanad ettevõtted).
4. **Rollid ja õigused.** `org_role`: owner > admin > operator > viewer, kogu ettevõttele
   (`organisation_members`); objektipõhist ligipääsu praegu pole. Andmebaas: RLS läbi
   `private.org_ids(min_role)` (arvestab ka ligipääsu olekut ja seanssi). Server: `OrgPage`
   (minRole), `actionContext(formData, minRole)`. Platvormi admin eraldi (`private.platform_admins`).
5. **Aruanded ja teavitused.** `lib/reports`: `build.ts` (struktureeritud andmed), `pdf.ts`
   (pdfmake serveris), `csv.ts` (UTF-8 BOM, `;`, valemikaitse); eksport
   `app/o/[org]/aruanded/[report]/eksport/route.ts`, RLS-kliendiga, ei salvestata. Teavitused:
   tabel `notifications`, loob ainult `private.generate_activity_reminders()` (pg_cron + trigger,
   lävendid `scheduled_activities.reminder_days`); rakenduses kelluke / `/teavitused`; valikuline
   e-kiri `private.email_outbox` kaudu.
6. **Testid ja build** — vt "Commands" allpool: `npm test` (unit), `npm run test:db` (pgTAP,
   vajab kohalikku Supabase'i/Dockerit), `npm run test:e2e` (Playwright), `npm run build`,
   kõik koos `npm run check`.
7. **Git.** Repo on GitHubis (`wyn7h6yn7d-cmyk/kaidly`), Vercel projekt `kaidly` on seotud.

## Next.js 16 — read the bundled docs

This project uses Next.js 16 (App Router, Turbopack, `proxy.ts` instead of middleware,
Cache Components). APIs and conventions differ from older versions and from most
training data. Before writing Next.js code, read the relevant guide in
`node_modules/next/dist/docs/` and follow its deprecation notices.

## Commands

```bash
npm run dev            # dev server, http://localhost:3000 (uses .env.local = hosted DEVELOPMENT project)
npm run dev:local      # dev server against the LOCAL Supabase stack (demo seed data)
npm run lint
npm run typecheck      # next typegen + tsc
npm test               # unit tests (node --test, tests/unit)
npm run db:start       # local Supabase (needs a running Docker-compatible runtime)
npm run db:reset       # rebuild local DB from migrations + seed
npm run test:db        # pgTAP database/RLS tests (supabase/tests)
npm run db:types       # regenerate lib/supabase/database.types.ts from the local DB
npm run db:seed-files  # sample document links and a photo link for the local demo org (after db:reset)
npm run build
npm run test:e2e       # Playwright, local stack only (own dev server on :3100)
npm run check          # lint, typecheck, unit, database tests, build
npx supabase migration new <name>
```

Use the project's pinned CLI (`npx supabase`, from devDependencies), not a global one.

## Non-negotiable rules

**Security / multi-tenancy**
- Every tenant table has `organisation_id`, RLS enabled **in the migration that creates it**, and policies using `private.org_ids(<min role>)`.
- Tenant isolation is enforced by RLS. Frontend filtering is convenience only.
- Never use the `service_role` / secret key in the app, and never add it to env files.
- Elevated operations are `security definer` functions with `set search_path = ''` and an explicit role check.
- `security definer` BEFORE triggers run before RLS and foreign keys: check membership of
  `new.organisation_id` first and scope every lookup to it, so errors never hint at another
  tenant's records (`supabase/tests/100_cross_tenant_oracles.test.sql`).
- Every table change ships with pgTAP tests covering the role matrix and cross-tenant access.
- New tables get **no** privileges by default (foundation migration). Each migration grants
  `authenticated` exactly the table/column privileges it needs; never grant to `anon`.
- `supabase/tests/000_security_baseline.test.sql` must keep passing. It pins the exact set
  of tables, security definer functions and callable RPCs: adding one means reviewing it
  (RLS, grants, role checks, pgTAP tests) and then adding it to the list.
- Every tenant table: composite FKs for organisation/site/installation consistency; every
  policy through `private.org_ids()`; ids from the database, never from the form.
- The operating log is append-only (corrections are new rows); deficiencies are never
  deleted; history is written by triggers only. Don't add update/delete paths.
- Organisations with operational history are never deleted (only deactivated); a deactivated
  organisation is read-only through `private.org_ids()` — keep new write paths going through it.
- Company name is mutable display data; the slug is the stable route identifier and is
  never regenerated or client-writable.
- KAIDLY platform administration (`/admin`) is authorised **only** by
  `private.is_platform_admin()` (table `private.platform_admins`, keyed by user id). Never
  by email, localStorage or a client claim; organisation roles never grant it; it never
  adds memberships or bypasses tenant RLS. Every `admin_*` function calls
  `private.require_platform_admin()` (→ `not_found`), returns metadata only (no document
  or log content, no credentials) and audits mutations in `private.admin_audit_log`. No
  impersonation, no viewing or setting passwords. Admins are granted only through
  `private.bootstrap_platform_admin()` by the database owner (DATABASE.md §5b).
- Commercial access (trial / active / expired) is per company, derived from
  `private.organisation_access` and enforced inside `private.org_ids()` for every role above
  viewer. New write policies must go through `org_ids(<role>)`; admin-level READ policies use
  `org_ids_readable(<role>)`. Only platform-admin RPCs change access; never trust UI state.
- Search and reports read through the user's own session (search_kaidly is SECURITY
  INVOKER; reports use the RLS client) — never a definer function or service key for
  customer content. Reports are generated on request and never stored or exposed by URL;
  no storage paths in exports. Build PDF/CSV from `lib/reports` structured data.
- Countdowns are derived, never stored: use `countdown`/`countdownText` from `lib/schedule.ts`
  (one implementation) with `todayInTallinn()`. Reminders are rows in `notifications`, created
  only by `private.generate_activity_reminders()` (pg_cron daily + activity trigger) with the
  unique identity (user, activity, due occurrence, threshold, channel); never insert them
  from the app, never store URLs in them, and keep them user-scoped (platform admins don't
  read them). Reminder e-mails hang off these rows (`private.email_outbox`); never compute
  deadlines a second time for e-mail.
- Plans (docs/SUBSCRIPTIONS.md) belong to the company and live on `private.organisation_access`;
  they differ only by limits (total users incl. pending invitations; active installations) —
  never gate a feature by plan. Limits are enforced by locking BEFORE triggers in the
  database; new member / invitation / installation paths must keep going through them. Only
  platform-admin RPCs change plans, limits, prices or paid periods; customers see
  `organisation_plan()` (no price, no notes). The 14-day trial is personal
  (`private.user_trials`, one per user, never reset by deleting/re-creating companies).
- Bulk data enters only through `import_company_data` (sites, installations; owner/admin of a
  writable company; all rows or none; idempotent per token). Never import operating history
  (log, deficiency resolutions, documents) without a designed provenance model.
- QA fixtures (`npm run qa:fixtures`) are local-only with a production-ref guard; never add a
  hosted variant.
- After changing a protection, mutation-test it: break it deliberately, see tests fail, restore.
- Never use `use cache` / `use cache: remote` for tenant data.
- Files: KAIDLY stores **no user files** (owner decision 2026-10-08, DATABASE.md §5k):
  documents are https links (`documents.external_url`), log entries and deficiencies have a
  photo link (`photos_url`). Never re-open uploads — no file inputs, no Storage INSERT
  policy, no file rows from users. Files uploaded before stay in the one private bucket,
  are read through short-lived signed URLs from the access-checked route, and can only be
  deleted through `delete_document_file` + Storage remove + `confirm_document_file_removed`
  (file removed, row kept as a trace). No `service_role` anywhere, including scripts.

**Environments**
- Preview/feature branches → DEVELOPMENT Supabase `gdpzavhkblbcxivoaqax`; `main`/Production →
  a separate PRODUCTION project. Never share a database, never copy development data to
  production, never hard-code project refs. Production setup and release gate:
  docs/DEPLOYMENT.md, docs/RELEASE_CHECKLIST.md — do not merge `main` while the gate is red.
- New tenant policies go through `org_ids()` / `org_ids_readable()`, which also enforce live
  sessions. There are no upload paths (DATABASE.md §5k).

**Database**
- All schema, policy and bucket changes go through `supabase/migrations/`. No manual dashboard changes.
- Never edit a migration that has been applied outside a local machine (e.g. pushed to the
  hosted development project); write a new one.
- Update `docs/DATABASE.md` in the same commit as the migration. Regenerate types.

**Code**
- Pages inside an organisation use `OrgPage` (membership + minRole); actions use
  `actionContext(formData, minRole)`. A 0-row write is a failure, not a success.
- Forms use `useFormAction` (keeps values after errors) and `useFieldId` (unique ids — Next
  keeps hidden copies of visited pages). Selects and radio groups get a `key` from the value.
- Server Components read through `lib/data/*` (`server-only`); writes are Server Actions in `lib/actions/*` that validate input on the server.
- Select explicit columns. Map database errors to Estonian user messages.
- Lists that grow over time are paginated with a deterministic order (id tie-break); no
  per-row queries (N+1) and no signing URLs for whole lists.
- Exception: the internal KAIDLY Admin console is Estonian-only (`lib/admin/strings.ts`).
- UI strings live in `lib/i18n/et.ts` (source) **and** `en.ts`, `ru.ts` (same keys — the typecheck
  and `tests/unit/i18n.test.ts` fail otherwise). Server code: `const t = await getT()` from
  `@/lib/i18n/server`; client components: `const t = useT()` from `@/lib/i18n/client`. No
  hard-coded user-facing text; dates/numbers via `t.fmt`. Never translate identifiers,
  filenames or user input. Russian changes need native electrical-professional review.
- Actions return error **codes** (`failure("code")`, `ActionState.errorCode`), never text;
  `FormMessage code={...}` translates them.
- Routes never change with the language.
- User-facing errors are application-controlled codes mapped to messages (`lib/auth/errors.ts`,
  `t.errors`). Never display or put provider/database error text in URLs.
- Redirect targets from user input go through `safeRedirectPath` (allowlist in `lib/auth/redirect.ts`).
- Required configuration goes through `lib/env.ts`, which fails closed.
- Code identifiers in English; URL segments in Estonian.
- Keep dependencies minimal — justify every new package. Versions are pinned exactly
  (`.npmrc` save-exact); don't upgrade without a concrete reason.
- No AI features, payments, IoT, EAM/ERP integrations or other out-of-scope functionality.
- E-mail: Auth mails are Supabase templates (`scripts/email-templates.mjs`, docs/EMAIL_TEMPLATES.md);
  the only application e-mail is the optional, generic deadline reminder sent by the database
  outbox (docs/EMAIL_NOTIFICATIONS.md). E-mails never contain operational data (no company,
  site, installation, activity, date, person or id), no tracking, no remote images; recipients
  come from `auth.users`, never from client input; the per-user preference is rechecked at send.

**Design**
- Follow `docs/DESIGN.md`. Restrained, industrial, light theme only.
- Layout system (DESIGN.md §9): `.k-container` (public) / `.k-app-container` (app), fluid
  gutters, `minmax(0,1fr)` grid tracks and `min-w-0` children, buttons may wrap, no
  negative-margin patches, no `overflow-x: hidden` to hide bugs. `e2e/layout.spec.ts` must
  pass (320–1440 px, 200 % text).
- No gradients, glow, glassmorphism, card grids, illustrations, big radii or heavy shadows.
- Mobile-first: 44 px touch targets, 16 px inputs, primary action in thumb reach.

## Definition of done

`npm run check` and `npm run test:e2e` pass (CI runs the same), including the layout and ET/EN/RU accessibility specs; RLS tests cover touched tables; the feature
works at 375 px (no horizontal scroll, 44 px targets); docs updated if behaviour or schema
changed.
