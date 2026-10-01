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
  page.tsx                     public landing (placeholder until Phase 9)
  auth/                        login, sign-up, confirm, error, forgot/update password
  invite/[token]/              invitation landing (sign-in required)
  konto/                       own profile
  o/
    page.tsx                   organisation picker (redirects to the last used one)
    uus/                       create organisation
    not-found.tsx              "organisation not found" (unknown or not a member)
    [org]/
      layout.tsx               app shell, membership check
      page.tsx                 overview
      objektid/                sites: list, uus, [site], [site]/muuda
      paigaldised/             installations: uus, [installation] (+ layout with tabs),
                               [installation]/{muuda, paevik, kaidukava, puudused, dokumendid}
      paevik/                  organisation operating log with filters
      kaidukava/               plan: list, uus, [activity], [activity]/{tehtud, muuda}
      puudused/                deficiencies: list, uus, [deficiency], [deficiency]/{lahenda, muuda}
      dokumendid/              placeholder (Phase 7)
      seaded/                  organisation settings, liikmed (members + invitations)
components/
  ui/                          primitives (button, input, select, textarea, label, dropdown)
  app/                         shell, page header, states, filter panel, org page wrapper
  forms/                       field, messages, confirm form, useFormAction, useFieldId
  auth/ organisations/ sites/ log/ schedule/ deficiencies/   feature components
  brand/                       provisional logo
lib/
  supabase/                    clients (browser, server, proxy), generated database.types.ts
  auth/                        session, roles, redirect allowlist, auth error codes
  data/                        server-only reads, one file per area
  actions/                     Server Actions, one file per area; context.ts (role check), state.ts
  validation/                  zod schemas
  db/errors.ts                 database error → application error code
  i18n/                        et.ts (all UI strings), index.ts
  schedule.ts, time.ts, labels.ts, env.ts
scripts/                       local-supabase.mjs, dev-local.mjs (local stack only)
tests/unit/                    node --test unit tests
e2e/                           Playwright suite + support/fixtures.ts
supabase/                      migrations, seed (local only), pgTAP tests, config
```

URL segments are Estonian (`objektid`, `paigaldised`, `paevik`, `kaidukava`, `puudused`);
code identifiers are English.

## 4. Routes (implemented)

| Route | Purpose | Min role |
|---|---|---|
| `/`, `/auth/*` | landing, authentication | public |
| `/invite/[token]` | invitation preview and accept | signed in |
| `/o`, `/o/uus`, `/konto` | organisation picker, create, own profile | signed in |
| `/o/[org]` | overview: real counts and sites | viewer |
| `/o/[org]/objektid` (+ `?arhiiv`) | sites | viewer |
| `/o/[org]/objektid/uus`, `/[site]/muuda` | create/edit/archive site | admin |
| `/o/[org]/objektid/[site]` | site with its installations | viewer |
| `/o/[org]/paigaldised/uus?objekt=` | new installation | admin |
| `/o/[org]/paigaldised/[installation]` | tabs: Ülevaade · Käidupäevik · Käidukava · Puudused · Dokumendid (placeholder) | viewer |
| `/o/[org]/paigaldised/[installation]/muuda` | edit/archive installation | admin |
| `…/[installation]/paevik` (+ `/uus`, `/[entry]`, `/[entry]/paranda`) | installation log, new entry, entry history, correction | viewer / operator |
| `/o/[org]/paevik` | organisation log; filters `objekt`, `paigaldis`, `liik`, `alates`, `kuni`; `lk` page | viewer |
| `/o/[org]/kaidukava` (+ `?arhiiv`) | plan; filters `objekt`, `paigaldis`, `seis`, `prioriteet` | viewer |
| `/o/[org]/kaidukava/uus?paigaldis=`, `/[activity]/muuda` | create/edit/archive activity | admin |
| `/o/[org]/kaidukava/[activity]` (+ `/tehtud`) | activity and completion history; "Märgi tehtuks" | viewer / operator |
| `…/[installation]/kaidukava` | installation plan | viewer |
| `/o/[org]/puudused` | deficiencies (default: active); filters `objekt`, `paigaldis`, `seis`, `raskus`, `tahtaeg=uletatud` | viewer |
| `/o/[org]/puudused/uus?paigaldis=`, `/[deficiency]/muuda`, `/lahenda` | record, edit, resolve | operator |
| `/o/[org]/puudused/[deficiency]` | detail; Märgi töös / Lahenda puudus | viewer |
| `…/[installation]/puudused` | active first, resolved in a separate section | viewer |
| `/o/[org]/seaded`, `/seaded/liikmed` | settings (owner edits), members and invitations | viewer (admin manages) |
| `/o/[org]/dokumendid` | placeholder (Phase 7) | viewer |

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

The browser talks to Supabase directly only for **auth** (the auth forms). File uploads
will also go straight to Storage in Phase 7, covered by storage policies.

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

## 7. Auth flow

- Sign-up with name, email + password → confirmation email → `/auth/confirm` → `/o`.
  The name is passed as user metadata and copied into `profiles` by trigger.
- Sign-in → `?next=` (if allowed) or `/o` (→ last used organisation from Phase 2).
- Password recovery email → `/auth/confirm?next=/auth/update-password` → new password → `/o`.
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
  quality ~0.8) before upload. Saves data on site and storage cost.
- Log entry drafts are kept in `localStorage` per installation until saved successfully.

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
| Unit | `node --test` (built in), 38 tests | Redirect allowlist, error-code mapping, configuration, roles, validation, Tallinn time, due-state logic. |
| End-to-end | Playwright, 35 tests | Auth (incl. email confirmation via local Mailpit), organisations and invitations, tenant isolation by URL, sites/installations and role restrictions, operating log + corrections, plan completion, deficiency resolution. Desktop; tests tagged `@responsive` also run at 375 px and 768 px. |
| Checks | `npm run check` (lint, typecheck, unit, database, build) + `npm run test:e2e` | Before every commit; CI is Phase 10. |
