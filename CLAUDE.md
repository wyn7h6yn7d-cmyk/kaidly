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

## Next.js 16 — read the bundled docs

This project uses Next.js 16 (App Router, Turbopack, `proxy.ts` instead of middleware,
Cache Components). APIs and conventions differ from older versions and from most
training data. Before writing Next.js code, read the relevant guide in
`node_modules/next/dist/docs/` and follow its deprecation notices.

## Commands

```bash
npm run dev            # dev server, http://localhost:3000 (uses .env.local = hosted DEVELOPMENT project)
npm run lint
npm run typecheck      # next typegen + tsc
npm test               # unit tests (node --test, tests/unit)
npm run db:start       # local Supabase (needs a running Docker-compatible runtime)
npm run db:reset       # rebuild local DB from migrations + seed
npm run test:db        # pgTAP database/RLS tests (supabase/tests)
npm run db:types       # regenerate lib/supabase/database.types.ts from the local DB
npm run build
npm run check          # all of the above except db:start/reset, in order
npx supabase migration new <name>
```

Use the project's pinned CLI (`npx supabase`, from devDependencies), not a global one.

## Non-negotiable rules

**Security / multi-tenancy**
- Every tenant table has `organisation_id`, RLS enabled **in the migration that creates it**, and policies using `private.org_ids(<min role>)`.
- Tenant isolation is enforced by RLS. Frontend filtering is convenience only.
- Never use the `service_role` / secret key in the app, and never add it to env files.
- Elevated operations are `security definer` functions with `set search_path = ''` and an explicit role check.
- Every table change ships with pgTAP tests covering the role matrix and cross-tenant access.
- New tables get **no** privileges by default (foundation migration). Each migration grants
  `authenticated` exactly the table/column privileges it needs; never grant to `anon`.
- `supabase/tests/000_security_baseline.test.sql` must keep passing: RLS on every table,
  nothing for `anon`, no TRUNCATE for `authenticated`, `search_path` on security definer functions.
- Never use `use cache` / `use cache: remote` for tenant data.

**Database**
- All schema, policy and bucket changes go through `supabase/migrations/`. No manual dashboard changes.
- Never edit a migration that has been applied outside a local machine (e.g. pushed to the
  hosted development project); write a new one.
- Update `docs/DATABASE.md` in the same commit as the migration. Regenerate types.

**Code**
- Server Components read through `lib/data/*` (`server-only`); writes are Server Actions in `lib/actions/*` that validate input on the server.
- Select explicit columns. Map database errors to Estonian user messages.
- UI strings in `lib/i18n/et.ts`, used via `t` from `@/lib/i18n`. No hard-coded user-facing text in components.
- User-facing errors are application-controlled codes mapped to messages (`lib/auth/errors.ts`,
  `t.errors`). Never display or put provider/database error text in URLs.
- Redirect targets from user input go through `safeRedirectPath` (allowlist in `lib/auth/redirect.ts`).
- Required configuration goes through `lib/env.ts`, which fails closed.
- Code identifiers in English; URL segments in Estonian.
- Keep dependencies minimal — justify every new package. Versions are pinned exactly
  (`.npmrc` save-exact); don't upgrade without a concrete reason.
- No AI features, payments, IoT, EAM/ERP integrations, email infrastructure or other out-of-scope functionality.

**Design**
- Follow `docs/DESIGN.md`. Restrained, industrial, light theme only.
- No gradients, glow, glassmorphism, card grids, illustrations, big radii or heavy shadows.
- Mobile-first: 44 px touch targets, 16 px inputs, primary action in thumb reach.

## Definition of done

`npm run check` passes (lint, typecheck, unit tests, database tests, build); RLS tests cover
touched tables; the feature works on a phone-sized viewport; docs updated if behaviour or
schema changed.
