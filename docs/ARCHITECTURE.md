# KAIDLY — Architecture

Status: describes the implemented system (Phases 1–6).

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16 App Router** (Turbopack) | Server Components by default; Server Actions for writes; `proxy.ts` (formerly middleware) refreshes the session. |
| Language | TypeScript, `strict: true` | Already enabled. |
| Database | Supabase PostgreSQL | Schema in `supabase/migrations/`. See [DATABASE.md](DATABASE.md). |
| Auth | Supabase Auth via `@supabase/ssr` | Email + password, email confirmation, password reset (from the starter). |
| Files | Supabase Storage | One private bucket, signed URLs. |
| Styling | Tailwind CSS 3 + a small set of shadcn/ui primitives | Restyled to the KAIDLY tokens. See [DESIGN.md](DESIGN.md). |
| Icons | lucide-react | Already installed. |
| Hosting | Vercel | Region close to the Supabase project (EU). |

### Dependency policy

Keep the dependency list short. Before adding a package, check whether the platform
already does it (`FormData`, `Intl.DateTimeFormat`, `<input capture>`, `canvas` for image
resizing). Proposed additions for the whole MVP:

| Package | Why | Decision |
|---|---|---|
| `supabase` 2.115.0 (CLI, dev dependency) | Migrations, type generation, `supabase test db` | **Added in Phase 1**, pinned so every machine and CI use the same CLI |
| `zod` | Validate every Server Action input on the server | Approved (D8); added in Phase 2 with the first Server Action |
| `@playwright/test` 1.63.0 (dev) | E2E suite (`npm run test:e2e`, local stack only) | **Added after Phase 6** |

Unit tests use Node's built-in test runner (`node --test`, native TypeScript type
stripping) — no test library. Removed in Phase 1: `next-themes`, `@radix-ui/react-checkbox`.

**Reproducibility:** every direct dependency is pinned to an exact version (no `^`, no
`latest`), `package-lock.json` is committed, `.npmrc` has `save-exact=true` and
`engine-strict=true`, `.nvmrc` pins Node 24 (`engines` requires ≥ 22.18 for native
TypeScript in tests). Versions are only changed for a concrete reason, in a separate commit.
`eslint-config-next` is aligned with Next (16.3.8) and uses the native flat config documented
for Next 16 (`eslint.config.mjs`); `@eslint/eslintrc` was removed with the old `FlatCompat` setup.

Nothing else is planned. No state-management library, no ORM, no date library, no
form library, no component kit beyond the shadcn primitives already in the repo.

## 2. Starter findings (before Phase 1)

Verified on 2026-10-01, before any changes. Phase 1 resolved every item below — see the
list that follows the table.

| Area | Finding |
|---|---|
| Next.js | 16.3.8, App Router, Turbopack, `cacheComponents: true`, `proxy.ts` session refresh. **Builds successfully**; `tsc --noEmit` passes. |
| React | 19.3.0 |
| Supabase | `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.117.2. Browser client (`lib/supabase/client.ts`), server client (`lib/supabase/server.ts`), proxy session refresh (`lib/supabase/proxy.ts`) — the standard, correct pattern. Uses `getClaims()` (JWT verified), not `getSession()`. |
| Connection | Project reachable; `/auth/v1/health` returns 200 with the publishable key. |
| Auth starter | Login, sign-up, forgot/update password, email confirm route, a `/protected` demo page. Forms are client components calling Supabase directly. |
| Env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only. `.env.local` exists and is git-ignored (`.env*.local` in `.gitignore`). No secret keys in the project. |
| TypeScript | `strict: true`. |
| Lint | Source code has 1 error (`require()` in `tailwind.config.ts`). `npm run lint` also scans the generated `.next/` folder (≈7 000 false errors) — needs an ignore. |
| Dependencies | `next`, `@supabase/ssr`, `@supabase/supabase-js` are pinned to `"latest"` — not reproducible. `eslint-config-next` is 15.3.1 against Next 16. |
| Database | No `supabase/` folder, no migrations, no tables yet. Supabase CLI 2.115.0 installed. Docker is **not** installed, so a local Supabase stack can't run yet (D1). |

### Starter issues — fixed in Phase 1

1. **Open redirect** (`app/auth/confirm/route.ts`): `next` now goes through
   `safeRedirectPath()` (`lib/auth/redirect.ts`), an **allowlist of known internal paths**
   (`/o…`, `/konto`, `/auth/update-password`, `/invite/<token>`). Absolute URLs,
   protocol-relative URLs, backslashes, query strings and unknown paths fall back to `/o`.
   The same function guards `?next=` on the login page.
2. **User-controlled error text** (`app/auth/error/page.tsx`): the URL now carries only an
   error **code** (`?code=link_expired`); the page shows the matching message from
   `t.errors`, or a generic one for anything unknown. Supabase errors are mapped to codes
   by `authErrorCode()` (`lib/auth/errors.ts`) everywhere, so provider text is never shown.
3. **Fail-open on missing configuration**: `lib/env.ts` validates the Supabase URL and key
   (missing, `.env.example` placeholders, non-https, URL with a path). The proxy returns a
   500 with a clear configuration message in development (generic Estonian text in
   production) instead of skipping authentication; the Supabase clients throw.
4. Proxy uses an explicit **public route list**; every other route requires a session.
   Signed-in users visiting login/sign-up are sent to `/o`.
5. Removed tutorial, hero, deploy button, logos, theme switcher, `/protected`, starter images.
6. Dependencies pinned (§1); `eslint-config-next` aligned to 16.3.8 with flat config; ESLint ignores generated folders; `require()` in Tailwind config fixed.
7. `lang="et"`, Estonian metadata and UI.
8. `turbopack.root` set, so the stray `~/package-lock.json` is ignored without warnings.

Also: `/auth/confirm` handles both the default PKCE `code` link and the `token_hash` email
template, so confirmation works with Supabase's default templates.

## 3. Folder structure

```
app/
  page.tsx                     public landing (header/footer in components/marketing)
  auth/                        login, sign-up, confirm, error, forgot/update password
  invite/[token]/              invitation landing (sign-in required)
  konto/                       own profile and language
  o/
    page.tsx                   organisation picker (redirects to the last used one)
    uus/                       create organisation
    not-found.tsx              "organisation not found" (unknown or not a member)
    [org]/
      layout.tsx               app shell, membership check
      page.tsx                 overview: what needs attention, first-use checklist
      sissekanne/              quick entry: pick an installation → its entry form
      objektid/                sites: list, uus, [site], [site]/muuda
      paigaldised/             installations: uus, [installation] (+ layout with tabs),
                               [installation]/{muuda, paevik, kaidukava, puudused, dokumendid}
      paevik/                  organisation operating log with filters
      kaidukava/               plan: list, uus, [activity], [activity]/{tehtud, muuda}
      puudused/                deficiencies: list, uus, [deficiency], [deficiency]/{lahenda, muuda}
      dokumendid/              documents: list, uus, [document], [document]/ava (route handler → signed URL)
      seaded/                  organisation settings, liikmed (members + invitations)
components/
  ui/                          primitives (button, input, select, textarea, label, dropdown)
  app/                         shell, page header, states, filter panel, org page wrapper
  forms/                       field, messages, confirm form, useFormAction, useFieldId
  auth/ organisations/ sites/ log/ schedule/ deficiencies/   feature components
  documents/                   upload queue hook, picker, uploader, lists, upload/edit forms
  dashboard/                   attention sections, onboarding checklist
  brand/                       provisional logo
lib/
  supabase/                    clients (browser, server, proxy), generated database.types.ts
  auth/                        session, roles, redirect allowlist, auth error codes
  data/                        server-only reads, one file per area
  actions/                     Server Actions, one file per area; context.ts (role check), state.ts
  validation/                  zod schemas
  db/errors.ts                 database error → application error code
  i18n/                        et.ts, en.ts, ru.ts (same keys), index.ts (types), server.ts (getT),
                               client.tsx (I18nProvider, useT), format.ts (dates/numbers), locales.ts
  history.ts                   activity_history rows → readable events (allowlisted fields)
  documents/                   rules.ts (types, size, filenames — shared), upload-client.ts (browser: resize, XHR upload)
  schedule.ts, time.ts, labels.ts, env.ts
scripts/                       local-supabase.mjs, dev-local.mjs, seed-files.mjs (local stack only)
.github/workflows/ci.yml       CI: verify, database, e2e jobs
tests/unit/                    node --test unit tests
e2e/                           Playwright suite + support/fixtures.ts
supabase/                      migrations, seed (local only), pgTAP tests, maintenance/ (read-only reports), config
```

URL segments are Estonian (`objektid`, `paigaldised`, `paevik`, `kaidukava`, `puudused`);
code identifiers are English.

## 4. Routes (implemented)

| Route | Purpose | Min role |
|---|---|---|
| `/`, `/auth/*` | landing, authentication | public |
| `/invite/[token]` | invitation preview and accept | signed in |
| `/o`, `/o/uus`, `/konto` | organisation picker, create, own account: name/phone, email change (Auth confirmation), password change (current password required), language, sign out here / other devices | signed in |
| `/teavitused` (`?vaade=lugemata|koik`, `lk`) | notification centre: unread first, mark one / all read, older pages | signed in |
| `/teavitused/[id]` | route handler: marks read and redirects to `/o/<slug>/kaidukava/<activity>` built from database ids (no stored URLs, no open redirect) | signed in (own notification) |
| `/admin`, `/admin/users`, `/admin/users/[user]`, `/admin/companies`, `/admin/companies/[company]`, `/admin/deadlines`, `/admin/system`, `/admin/audit` | KAIDLY platform administration (Ülevaade, Kasutajad, Ettevõtted, Tähtajad, Süsteem, Admini logi) — Estonian-only, `noindex` | platform admin (everyone else: ordinary 404) |
| `/o/[org]` | overview: what needs attention (overdue, due soon, high/critical deficiencies, latest entries, sites with open items), first-use checklist | viewer |
| `/o/[org]/sissekanne` | quick entry: recently used installations first, then by site; one installation → straight to its form | operator |
| `/o/[org]/objektid` (+ `?arhiiv`) | sites | viewer |
| `/o/[org]/objektid/uus`, `/[site]/muuda` | create/edit/archive site | admin |
| `/o/[org]/objektid/[site]` | site with its installations | viewer |
| `/o/[org]/paigaldised/uus?objekt=` | new installation | admin |
| `/o/[org]/paigaldised/[installation]` | tabs: Ülevaade (status, first-entry prompt) · Käidupäevik · Käidukava · Puudused · Dokumendid | viewer |
| `/o/[org]/paigaldised/[installation]/muuda` | edit/archive installation | admin |
| `…/[installation]/paevik` (+ `/uus`, `/[entry]`, `/[entry]/paranda`) | installation log, new entry, entry history, correction | viewer / operator |
| `/o/[org]/paevik` | organisation log; filters `objekt`, `paigaldis`, `liik`, `alates`, `kuni`; `lk` page | viewer |
| `/o/[org]/kaidukava` (+ `?arhiiv`) | plan; filters `objekt`, `paigaldis`, `seis`, `prioriteet`; `lk` page | viewer |
| `/o/[org]/kaidukava/uus?paigaldis=`, `/[activity]/muuda` | create/edit/archive activity | admin |
| `/o/[org]/kaidukava/[activity]` (+ `/tehtud`) | activity and completion history; "Märgi tehtuks" | viewer / operator |
| `…/[installation]/kaidukava` | installation plan | viewer |
| `/o/[org]/puudused` | deficiencies (default: active); filters `objekt`, `paigaldis`, `seis`, `raskus`, `tahtaeg=uletatud`; `lk` page | viewer |
| `/o/[org]/puudused/uus?paigaldis=`, `/[deficiency]/muuda`, `/lahenda` | record, edit, resolve | operator |
| `/o/[org]/puudused/[deficiency]` | detail; Märgi töös / Lahenda puudus | viewer |
| `…/[installation]/puudused` | active first; latest 50 resolved with the total and a link to the full list | viewer |
| `/o/[org]/seaded`, `/seaded/liikmed` | company details (owners and admins edit; slug stays), members and invitations | viewer (admin manages) |
| `/o/[org]/seaded/ajalugu` (`?ala=`, `lk`) | change history, read-only | admin |
| `/o/[org]/seaded/kustuta` | delete (no history) or deactivate (history) the organisation, typed-name confirmation | owner |
| `/o/[org]/abi` | getting-started guide with real progress, six core terms | viewer |
| `/o/[org]?uus` | one-time "Ettevõte on valmis" welcome after creating an organisation | viewer |
| `/o/[org]/dokumendid` (+ `?arhiiv=1`) | ready documents; filters `objekt`, `paigaldis`, `liik`, `alates`, `kuni`; `lk` page | viewer |
| `/o/[org]/dokumendid/uus?paigaldis=` / `?objekt=` | upload a general document (operators: installations only) | operator |
| `/o/[org]/dokumendid/[document]` | details, open/download; admins rename, recategorise, archive/restore general documents | viewer |
| `/o/[org]/dokumendid/[document]/ava` (+ `?lae=1`) | route handler: access check → 302 to a 60-second signed URL; 404 for unknown, foreign or incomplete | viewer |
| `…/[installation]/dokumendid` | all ready documents of the installation incl. entry/deficiency attachments | viewer |

Every page re-checks membership (`OrgPage`) and scopes every query to the organisation
from the URL. Unknown or foreign record ids render "Lehte ei leitud"; insufficient roles
render "Ligipääs puudub"; finished records ("already resolved", "already completed",
archived) render a clear notice instead of a permission error.

## 5. Data access

**Reads** happen in Server Components through functions in `lib/data/*` (marked
`import 'server-only'`). Each function:
1. creates the server Supabase client (user's cookies → user's JWT → RLS applies),
2. selects explicit columns (no `select('*')` in pages),
3. returns typed data from the generated `Database` types.

**Writes** happen in Server Actions in `lib/actions/*`. Each action:
1. validates `FormData` with a zod schema (never trusts the client),
2. resolves the organisation from the URL slug through RLS (`actionContext`), never from a
   client-supplied organisation id, and takes site/installation ids from the database, not
   the form,
3. calls Supabase as the user (RLS applies) or one of the RPCs (DATABASE.md §7); a write
   that RLS filters out (0 rows) is reported as forbidden/not found, never as success,
4. maps database errors to Estonian messages (`lib/db/errors.ts`) and returns
   `{ ok, error, fields }`; the client keeps typed values on failure (`useFormAction`),
5. redirects or calls `refresh()`.

The browser talks to Supabase directly only for **auth** (the auth forms) and for **file
bytes**: an upload goes straight to Storage with the user's own session, so files never
pass through the app server.

**Upload flow** (`components/documents/use-upload-queue.ts`):
1. `registerUpload` (Server Action) validates type, extension, size and filename, resolves
   the target (organisation, site, installation, log entry or deficiency) through RLS and
   inserts a `pending` documents row; the database generates the object path.
2. The browser resizes photos (≤ 2048 px, JPEG ~0.82; PNG stays PNG; HEIC from Safari is
   converted) and uploads with `XMLHttpRequest` for progress, `x-upsert: false`.
3. `finalizeUpload` → `finalize_document` checks the object and marks it `ready`.
4. On any failure `discardUpload` removes the object and the pending row; the file stays in
   the list with "Proovi uuesti".
Log-entry photos: the form saves the entry first (the action returns its id instead of
redirecting when files are queued), then uploads to it. If an upload fails the entry is
already saved; the form keeps its values and offers retry or "continue without".
Files are opened through `/o/[org]/dokumendid/[id]/ava`, which signs one 60-second URL on
demand — nothing is pre-signed for lists, and thumbnails load lazily through the same route.

**Authorisation layers**, from strongest to weakest:
1. Postgres RLS + storage policies — the real boundary.
2. `requireOrg(slug)` / `OrgPage minRole` in every page and `actionContext(formData, minRole)` in every action — gives a proper not-found/forbidden page instead of empty lists, and hides buttons the user can't use.
3. Proxy — only refreshes the session and redirects anonymous users to login. Never trusted for authorisation (per the Next.js 16 guidance).

An unknown org slug and an org the user isn't a member of both return the same **404**
page, so the response doesn't reveal whether an organisation exists. Slugs are stable and
non-sequential URL identifiers, not a security mechanism; access is enforced by RLS.

## 6. Caching and rendering (Next.js 16, Cache Components)

The starter ships with `cacheComponents: true`. Under Cache Components, anything that reads
cookies is request-time and must sit inside a `<Suspense>` boundary — every tenant page
does, because the Supabase client reads the session cookie.

Rules:
- **Never use `use cache` (or `use cache: remote`) for tenant data.** A cached function can't
  carry the user's JWT, so it would have to bypass RLS — exactly what we forbid. Tenant data
  is always fetched per request as the user.
- Static parts (marketing pages, the app shell frame) can be cached / prerendered.
- Each page puts its data behind `<Suspense>` with a skeleton matching the final layout, so
  navigation feels instant on mobile.
- After a write, the action calls `revalidatePath` (or `refresh`) for the affected route.

Cache Components stays enabled (D10). Phase 1 confirmed the pattern: session reads sit
behind `<Suspense>` in `app/o/layout.tsx` and `app/o/page.tsx`.

**Language and rendering.** The language comes from the `kaidly_locale` cookie (§6b), so
the root layout wraps the app in `<Suspense><LocaleBoundary>` and page metadata is
generated per request. Consequence: routes have no prerendered static shell — including the
public landing page — and Next's dev-time "instant navigation" insights report runtime data
in `generateMetadata()`. Behaviour and security are unaffected (every app route was already
per-request because of the session). *Performance debt:* per-locale cached shells
(`use cache` keyed by locale for public pages) would restore CDN-served landing pages.

## 6a. Next.js 16 behaviours that shaped the UI code

- **Hidden pages stay mounted.** With Cache Components, Next keeps up to three visited
  pages in the DOM (React `<Activity>`, `display: none`). Fixed element ids would be
  duplicated, so form ids come from `useFieldId()` (`components/forms/use-field-id.ts`).
- **Forms reset after every action.** React 19 resets a form after a Server Action, even a
  failed one. `useFormAction()` keeps the submitted values and fields use them as
  `defaultValue`; `<select>`s also get a `key` so they really show the submitted option.
- **Pages check access themselves.** `OrgPage` resolves the membership for each page; the
  `/o/[org]` layout check is not relied on (layouts and pages render in parallel).
- `forbidden()` is experimental in Next 16, so insufficient roles render `ForbiddenState`.
- **Pages re-render after an action**, even a failed one. A page whose record changed state
  in the meantime (resolved, completed, archived) shows `NoticeState` ("already done"),
  never a misleading permission error.
- **Radio groups** (entry type, frequency) also get a `key` from the submitted value, for the
  same reset reason as selects.
- **Dev-only log noise:** Next's "instant navigation" validation logs `Could not validate
  instant … NEXT_HTTP_ERROR_FALLBACK;404` when a route correctly calls `notFound()` (e.g. a
  non-member opening an organisation). Expected; production is unaffected.
- **Tests must ignore hidden pages:** E2E locators use visible fields or accessible names
  (lists carry `aria-label`s), never "first match in the DOM".

## 6a2. Onboarding (derived, not stored)

`lib/onboarding.ts` turns five counts (sites, installations, log entries, plan activities,
ready documents) and the user's role into six steps: done, the link to do it, or why it
can't be done yet (missing site/installation, or role). `lib/data/onboarding.ts` reads the
counts with head queries. Nothing about progress is stored; the only state is a per-browser
cookie that hides the checklist on the overview (`kaidly_guide_hidden_<org>`), undone from
Abi. Empty modules use `GuidedEmptyState` (purpose, examples or sequence, prerequisite, one
action, or who does it).

## 6b. Languages (ET / EN / RU)

- **Dictionaries:** `lib/i18n/et.ts` is the source; `en.ts` and `ru.ts` are typed as
  `Messages`, so a missing or extra key fails the typecheck; `tests/unit/i18n.test.ts`
  re-checks key parity at runtime, empty strings, message functions and Russian plurals.
- **Server:** `await getT()` (`lib/i18n/server.ts`) in Server Components, metadata, actions
  and routes — cached per request; reads the cookie.
- **Client:** `useT()` (`lib/i18n/client.tsx`) from `I18nProvider`, rendered by
  `LocaleBoundary` in the root layout. Estonian is bundled; English and Russian load as
  separate chunks only when used (`use()` on a dynamic import).
- **Actions return error codes** (`ActionState.errorCode`), never text; `FormMessage`
  translates them, so a language switch never leaves stale server text.
- **Formatting:** `t.fmt.date/dateTime/time/number/bytes` per locale (en-GB, et-EE, ru-RU),
  always Europe/Tallinn.
- **`<html lang>`:** default `et`; an inline script sets it from the cookie before hydration
  (Next guide "Preventing flash before hydration"; reading cookies in the root layout would
  block every route); `I18nProvider` keeps it right after in-place switches; content is
  also wrapped in a server-rendered `lang`.
- **Preference:** `setLocale` (Server Action) writes the cookie (1 year, lax) and, when
  signed in, `profiles.preferred_locale` (own row, own column only). After sign-in
  `syncLocale` brings the device in step: the profile wins; a choice made while signed out is
  saved to an empty profile. `LocaleSync` covers sessions that start without the login form
  (email links, other devices). Switching calls `router.refresh()`: URL, organisation,
  session and form state stay.
- **Routes never change with the language** (`/o/[org]/paevik` in every language).

## 6c. Forms on unreliable networks

- `useFormAction` catches a failed Server Action request (`unstable_rethrow` lets Next
  redirects through) and returns the `network` error with the typed values kept.
- `useSaveThenUpload` (`components/documents/use-save-then-upload.tsx`) is the one
  implementation for "save a record, then upload its photos" (log entries, corrections,
  deficiencies): the action returns a `SavedRecord` when files follow; failed uploads leave
  the record saved and offer retry / continue.
- `useSessionDraft` keeps unsaved field values in `sessionStorage` (this tab only; cleared
  when the form goes out, restored if saving fails, discardable). Not an offline mode —
  full offline entry with sync remains future scope.
- Auth forms use `method="post"` so a submit before hydration can never put credentials in
  the URL.

## 6d. Platform administration (`/admin`)

- **Authorisation is database-backed:** `private.platform_admins` keyed by `auth.users.id`
  and `private.is_platform_admin()` (DATABASE.md §5b). Never an email comparison, a
  localStorage flag or a client claim; the founder's email appears only in the one-off
  bootstrap command, never in code (a unit test checks).
- `lib/data/admin.ts` (`server-only`): `isPlatformAdmin()` (cached per request, RPC
  `am_platform_admin`) and `requirePlatformAdmin()` → `notFound()`. The layout, every page
  and every action call it, and every read/write is an RPC that checks again in the
  database. Non-admins get the ordinary 404; layout metadata and the loading state contain
  no admin wording.
- `lib/actions/admin.ts`: role change, remove membership, disable/re-enable account, revoke
  sessions, send password reset. High-impact actions use `ConfirmAction` — a native
  `<dialog>` plus, for removal and disabling, typing the user's email, re-checked on the
  server. There is deliberately no impersonation and no way to see or set a password.
- **No service-role key.** Nothing in the app reads `SUPABASE_SERVICE_ROLE_KEY`; no Vercel
  variable is needed. (E2E fixtures use the *local* stack's key only to create test users.)
- **Estonian-only exception:** the console is used only by the KAIDLY team, so its copy
  lives in `lib/admin/strings.ts` (not the ET/EN/RU dictionaries) and its shell sets
  `lang="et"`. Customer-facing screens stay fully localised.
- Visually distinct: dark ink header with "KAIDLY Admin", white work surface, a standing
  notice that the console shows support metadata only and logs every change.
- "KAIDLY Admin" appears only when `am_platform_admin()` is true: as its own sidebar entry (above the account menu) inside an organisation, and in the account menu everywhere.

## 6e. Countdowns, reminders and notifications

- **One countdown implementation:** `lib/schedule.ts` `countdown(dueOn, today)` → days +
  level (`neutral` > 30 · `aware` ≤ 30 · `warning` ≤ 14 · `strong` ≤ 7 · `today` ·
  `overdue`) and `countdownText(value, t.countdown)` ("84 päeva jäänud", "Tähtaeg täna",
  "1 päev üle tähtaja"; EN/RU with plurals). `components/schedule/countdown-mark.tsx`
  renders it calmly (only the last week, today and overdue get coloured text). Used by
  `DueMark` (dashboard "Mis vajab tähelepanu", Käidukava lists, activity and installation
  pages), the notification centre, the toast and the admin console (`fmtDays`). `today`
  is always `todayInTallinn()`.
- **Bell:** `components/notifications/bell.tsx` — desktop in the sidebar header, mobile in
  the top bar (never in the bottom navigation), also in the plain header. The unread count
  is part of the accessible name ("Teavitused, 3 lugemata").
- **Toast:** `ReminderToast` shows the newest unread, current reminder created in the last
  7 days once per browser (ids remembered in localStorage — a convenience only; the
  reminder stays in Teavitused). Bottom-right on desktop, above the bottom navigation on
  mobile; an always-mounted `role="status"` `aria-live="polite"` region, auto-hides after
  12 s, closable. Old reminders are never announced again.
- **Reading:** `lib/data/notifications.ts` (`my_notifications` RPC, `notificationSummary`
  cached per request). Actions `markNotificationRead`, `markAllNotificationsRead`.
- **Future channels:** `notifications.channel` and the identity include the channel; email
  or push would add a channel value plus a delivery worker reading the same reminder
  events. Not implemented — no email provider, no push infrastructure.

## 7. Auth flow

- Sign-up with name, email + password → confirmation email → `/auth/confirm` → `/o`.
  The name is passed as user metadata and copied into `profiles` by trigger.
- Sign-in → `?next=` (if allowed) or `/o` (→ last used organisation from Phase 2).
- Password recovery email → `/auth/confirm?next=/auth/update-password` → new password → `/o`.
- **Account (`/konto`)**: email change via `supabase.auth.updateUser({ email })` — same
  user id; Auth sends confirmation (to both addresses with secure email change) and the
  profile email follows by trigger once confirmed. Password change via the
  `changePassword` Server Action: the **current password** is verified with a throw-away,
  non-persisting client (that check session is signed out again), then `updateUser({ password })`
  and `signOut({ scope: "others" })`. "Sign out other devices" = `signOut({ scope: "others" })`.
  Passwords travel only in POST bodies, are never stored, logged or returned, and the form
  never re-renders typed passwords (unit + E2E: no credential in any URL, request URL or table).
  Revocation removes refresh tokens at once; already-issued access tokens lapse at expiry
  (≤ 1 h, `jwt_expiry`), because JWTs are verified locally (`getClaims`).
- Admin-initiated reset sends the normal recovery email; it uses the PKCE flow, so the link
  works across browsers only with the `token_hash` recovery template (README).
- A new user with no memberships sees "Loo organisatsioon" (create) or pending invitations
  for their email.
- Inviting (D4): admin enters email + role → `create_invitation()` returns a random token
  once (only its SHA-256 hash is stored) → the app shows the copyable link
  `/invite/<token>`. The invitee signs up or signs in **with that email** and accepts. The
  token expires, is single-use and resolves organisation and role from the database row.
  No emails are sent by KAIDLY; there is no email infrastructure in the MVP.
- Session refresh in `proxy.ts` (starter pattern, kept as is).
- Supabase Auth settings: local values live in `supabase/config.toml` (site URL, redirect
  URLs, email confirmation on, minimum password length 10). The hosted project's settings
  are set by hand in the dashboard and listed in README (they are configuration, not schema).

## 8. Mobile and performance budget

- First load of a tenant page on 4G: usable < 2 s.
- No client-side data-fetching libraries; Server Components render lists.
- Client components only where interaction needs them (forms with photo upload, org switcher, filters).
- Images: user photos are resized in the browser (canvas → JPEG, longest side 2048 px,
  quality ~0.82) before upload. Saves data on site and storage cost. Thumbnails are the
  resized originals (no image transformation service); fine for a handful per record.
- Lists that grow are paginated (50, deterministic order, one extra row to detect more):
  log, documents, deficiencies, activities. Dashboard sections are `limit 5` + exact count;
  per-site counts come from one view. No N+1: labels come from one installation lookup.
- Only the active language's dictionary reaches the browser (Estonian bundled, others on
  demand).
- Unsaved form text is kept per tab in `sessionStorage` (§6c).

## 9. Environments and deployment

| Environment | Supabase | App |
|---|---|---|
| Local database | Supabase CLI stack in any Docker-compatible runtime (D1) — used for migrations and automated database tests | — |
| **Development** | The hosted project in `.env.local` (D2) | `npm run dev` |
| Preview | Development project until a staging project is needed | Vercel preview deployments |
| Production | Separate project, created before launch — **not yet** | `main` branch on Vercel |

- Migrations are developed and tested locally (`npm run db:reset`, `npm run test:db`), then
  applied to the hosted development project with `supabase db push`, later to production.
- The only environment variables the app needs are the two public Supabase values.
  `SUPABASE_ACCESS_TOKEN` / database password are used by the CLI on developer machines and
  in CI, never by the app. No secret or service-role key exists anywhere in the app.
- `npm run dev:local` runs the app against the local stack (values read from
  `supabase status`, refused unless they point at localhost). The E2E suite uses the same
  helper on port 3100.

## 10. Testing

| Level | Tool | Scope |
|---|---|---|
| Database / RLS | pgTAP via `supabase test db` | Every policy, every RPC, cross-tenant isolation. Mandatory per database phase. |
| Unit | `node --test` (built in), 76 tests | Redirect allowlist, error-code mapping, configuration, roles, validation, Tallinn time, due-state logic, file rules, change-history descriptions, dictionary parity (ET/EN/RU) and Russian plurals. |
| End-to-end | Playwright, 123 runs (desktop; `@responsive` tests also at 375 and 768 px) | Auth (incl. email confirmation via local Mailpit), organisations and invitations, tenant isolation by URL, sites/installations and role restrictions, operating log + corrections, plan completion, deficiency resolution and pagination, photo upload from a phone, upload failure and retry, deficiency photos at creation, network loss while saving, tab drafts, documents roles/archive/signed URLs, cross-tenant document 404s, dashboard scoping, first use, quick entry, change history and its access, language switching (anonymous and signed in, profile persistence), credentials never in the URL, account (email change, password change with current password, other devices), company details by role, platform admin (404 for owners and others, console pages at 375/768/1440, confirmations and audit, disabled account can't sign in, deadlines filters), reminder settings, bell and unread count, notification centre (mark one/all read, direct link), toast once per reminder (desktop and mobile), recurrence history, notification tenant isolation, ET/EN/RU countdowns, an axe-core WCAG 2.1 AA sweep in ET/EN/RU, and layout protection at 320–1440 px and 125/200 % text (`layout.spec.ts`). |
| Checks | `npm run check` (lint, typecheck, unit, database, build) + `npm run test:e2e` | Before every commit. |
| CI | GitHub Actions `.github/workflows/ci.yml` | On PRs and pushes to non-main branches: **verify** (lint, typecheck, unit, build with placeholder public config), **database** (fresh local stack in the runner: migrations + seed, pgTAP, generated types up to date), **e2e** (Playwright against the local stack; traces kept on failure). Actions pinned to SHAs, no secrets, no hosted project. |
