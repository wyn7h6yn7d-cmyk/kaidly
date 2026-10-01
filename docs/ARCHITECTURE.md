# KAIDLY — Architecture

Status: **approved 2026-10-01**. Phase 1 (foundation) implemented.

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
| `@playwright/test` (dev) | One end-to-end test of the critical log-entry flow | Phase 10 |

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

## 3. Folder structure (target)

```
app/
  (marketing)/                 public pages: /, later /hinnad, /kontakt
    layout.tsx
    page.tsx
  auth/                        login, sign-up, confirm, reset (from starter, restyled, Estonian)
  invite/[token]/              invitation landing (public → login → accept)
  o/                           the application (signed-in)
    page.tsx                   organisation picker / redirect to last used
    uus/page.tsx               create organisation
    [org]/                     everything inside one organisation (slug)
      layout.tsx               app shell: org switcher, nav, membership check
      page.tsx                 dashboard
      objektid/                sites
      paigaldised/             installations
      paevik/                  operating log (all installations)
      kaidukava/               scheduled activities
      puudused/                deficiencies
      dokumendid/              documents
      seaded/                  organisation settings, members, invitations
  konto/                       own profile, password, sign out
components/
  ui/                          primitives (button, input, …) — restyled shadcn
  app/                         app-specific building blocks (page header, list row, empty state, …)
  marketing/
  auth/                        auth forms (client components)
  brand/                       provisional logo
lib/
  supabase/                    clients (browser, server, proxy), generated database.types.ts
  auth/                        session.ts (getCurrentUser, requireUser; Phase 2: requireMembership),
                               redirect.ts (allowlist), errors.ts (error codes)
  env.ts                       required configuration, fails closed
  i18n/                        et.ts (all UI strings), index.ts (`t`, `Messages` type)
  data/                        server-only read functions, one file per area (Phase 2+)
  actions/                     server actions, one file per area (Phase 2+)
  validation/                  zod schemas shared by forms and actions (Phase 2+)
tests/unit/                    node --test unit tests
supabase/                      migrations, seed, tests, config (see DATABASE.md §7)
docs/
```

URL segments use Estonian words (`objektid`, `paigaldised`, `paevik` …) because users read
them. Code identifiers stay in English. (Decision D7.)

## 4. Page architecture

| Route | Purpose | Min role |
|---|---|---|
| `/` | Marketing landing | public |
| `/auth/login`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/update-password`, `/auth/confirm`, `/auth/error` | Auth | public |
| `/invite/[token]` | Shows the inviting organisation and role (`invitation_preview`); sign in / sign up; accept | public → signed in |
| `/o` | Organisation list; auto-redirect if the user has exactly one | signed in |
| `/o/uus` | Create organisation | signed in |
| `/o/[org]` | **Dashboard**: overdue + upcoming activities, open deficiencies, latest entries, **"Lisa sissekanne"** | viewer |
| `/o/[org]/objektid` | Sites list (search, archived toggle) | viewer |
| `/o/[org]/objektid/uus` | New site | admin |
| `/o/[org]/objektid/[siteId]` | Site: its installations, site documents | viewer |
| `/o/[org]/objektid/[siteId]/muuda` | Edit / archive site | admin |
| `/o/[org]/paigaldised/uus?objekt=…` | New installation | admin |
| `/o/[org]/paigaldised/[installationId]` | **Installation page**: header + tabs Päevik · Käidukava · Puudused · Dokumendid · Andmed | viewer |
| `/o/[org]/paigaldised/[installationId]/sissekanne` | **New log entry** (the critical flow) | operator |
| `/o/[org]/paigaldised/[installationId]/muuda` | Edit / archive installation | admin |
| `/o/[org]/sissekanne` | New log entry → pick installation first (recent first) | operator |
| `/o/[org]/paevik` | All log entries, filter by site / installation / type / date | viewer |
| `/o/[org]/kaidukava` | All scheduled activities: overdue, this month, later | viewer |
| `/o/[org]/kaidukava/uus`, `…/[id]` | Create / edit / complete activity | admin (edit), operator (complete) |
| `/o/[org]/puudused` | All deficiencies: open first, by severity and due date | viewer |
| `/o/[org]/puudused/uus`, `…/[id]` | Create / view / resolve | operator |
| `/o/[org]/dokumendid` | All documents, filter by site / installation / kind | viewer |
| `/o/[org]/seaded` | Organisation name, registry code | owner (admins see it read-only) |
| `/o/[org]/seaded/liikmed` | Members, roles, invitations | admin |
| `/konto` | Profile, password, sign out, leave organisation | signed in |

Log entries, deficiencies and documents are created in context (from an installation)
wherever possible; the organisation-wide lists exist for overview and audit.

## 5. Data access

**Reads** happen in Server Components through functions in `lib/data/*` (marked
`import 'server-only'`). Each function:
1. creates the server Supabase client (user's cookies → user's JWT → RLS applies),
2. selects explicit columns (no `select('*')` in pages),
3. returns typed data from the generated `Database` types.

**Writes** happen in Server Actions in `lib/actions/*`. Each action:
1. validates `FormData` with a zod schema (never trusts the client),
2. calls Supabase as the user (RLS applies) or calls one of the RPCs from DATABASE.md §5.5,
3. maps database errors to Estonian messages, returns `{ ok, error, fieldErrors }`,
4. revalidates the affected routes.

The browser talks to Supabase directly only for **auth** (starter forms) and **file
uploads** (straight to Storage, to avoid routing large files through Vercel functions).
Both are covered by RLS / storage policies.

**Authorisation layers**, from strongest to weakest:
1. Postgres RLS + storage policies — the real boundary.
2. `requireMembership(org, minRole)` in the `[org]` layout and in every action — gives a proper 404/403 page instead of empty lists, and hides buttons the user can't use.
3. Proxy — only refreshes the session and redirects anonymous users to login. Never trusted for authorisation (per the Next.js 16 guidance).

An unknown org slug and an org the user isn't a member of both return **404**, so slugs
can't be probed.

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
- To run the app against the local stack, start it with the values from
  `npx supabase status -o env` (`API_URL`, `PUBLISHABLE_KEY`) as `NEXT_PUBLIC_*` variables.

## 10. Testing

| Level | Tool | Scope |
|---|---|---|
| Database / RLS | pgTAP via `supabase test db` | Every policy, every RPC, cross-tenant isolation. Mandatory per database phase. |
| Unit | `node --test` (built in) | Pure security logic: redirect allowlist, error-code mapping, configuration checks. |
| End-to-end | Playwright | Sign in → open site → installation → add entry with photo → see it in the log. Phase 10. |
| Checks | `npm run check` = lint, typecheck, unit, database, build | Run before every commit; in CI on every push (GitHub Actions, Phase 10). |
