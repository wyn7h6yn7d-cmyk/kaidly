# KAIDLY

**Elektripaigaldise käit. Lihtsalt.** — a digital operations logbook for electrical
installations: käidupäevik, käidukava, puudused and dokumendid in one place.

Next.js 16 (App Router) · TypeScript · Supabase (Postgres, Auth, Storage) · Tailwind CSS · Vercel.

Project documentation lives in [`docs/`](docs/) and agent instructions in [`CLAUDE.md`](CLAUDE.md).

## Requirements

- Node.js 24 (see `.nvmrc`; ≥ 22.18 required)
- A Docker-compatible container runtime for the local database (Docker Desktop, Colima, Podman, …)
- Everything else, including the Supabase CLI, is installed by `npm install` at pinned versions.

## Setup

```bash
npm install
cp .env.example .env.local     # then fill in the DEVELOPMENT project's values
npm run dev                    # http://localhost:3000
```

`.env.local` needs exactly two values from the hosted **development** Supabase project
(Project Settings → API / API Keys):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` — no path |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key (`sb_publishable_…`) |

Never add the `service_role` / secret key. If configuration is missing or invalid, the app
refuses to run and says what's wrong (it does not fall back to skipping authentication).

## Local database and tests

```bash
npm run db:start      # start local Supabase (first run downloads images)
npm run db:reset      # rebuild the local database from supabase/migrations + seed.sql
npm run test:db       # pgTAP database/RLS tests in supabase/tests
npm run db:types      # regenerate lib/supabase/database.types.ts
npm run db:stop
```

Full check before every commit:

```bash
npm run check         # lint, typecheck, unit tests, database tests, production build
```

To run the app against the local stack instead of the development project, start it with
the local values (`npx supabase status -o env` → `API_URL`, `PUBLISHABLE_KEY`):

```bash
NEXT_PUBLIC_SUPABASE_URL=<API_URL> NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY> npm run dev
```

Local auth emails are caught by Mailpit (URL in `npx supabase status`).

## Database changes

All schema, policy and storage changes are migrations:

```bash
npx supabase migration new <name>   # write SQL, then:
npm run db:reset && npm run test:db && npm run db:types
```

No manual changes in the Supabase dashboard. See [`docs/DATABASE.md`](docs/DATABASE.md).

## Hosted development project (one-time, manual)

Migrations are applied to the hosted project with the CLI. This needs your Supabase
account and the database password, so it is done by hand:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>   # asks for the database password
npx supabase db push                            # applies supabase/migrations
```

Before the first push, check that the hosted Postgres major version matches
`supabase/config.toml` (`major_version = 17`): in the dashboard SQL editor run `show server_version;`.

Auth settings for the hosted project (Authentication → URL Configuration / Providers):

- **Site URL**: `http://localhost:3000` for development (production URL later).
- **Redirect URLs**: `http://localhost:3000/**` (add preview/production URLs when they exist).
- **Email confirmations**: on. **Minimum password length**: 10.
- Optional, recommended: in the "Confirm signup" and "Reset password" email templates use
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}`
  (and `type=recovery` for reset), so links work even when opened in a different browser.
  The default templates also work, but only in the browser where the user started.
