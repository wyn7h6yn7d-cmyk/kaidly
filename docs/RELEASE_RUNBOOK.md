# KAIDLY — Release runbook (copy/paste)

Development `gdpzavhkblbcxivoaqax` · Production `xakpbtmksxvjmsbipwmj` (**msbi**, never "msbl").
Production is deployed by pushing `main`; the database is migrated by hand **before** the
push when a release has migrations. No v1.0.0 tag until the launch gate is green.

## 1. Pre-release tests (local stack running)

```bash
git status                       # must be clean
npm ci && npx supabase db reset
npm run lint && npm run typecheck && npm test && npm run test:db && npm run build
npx playwright test --workers=2  # full E2E (2 workers on a busy machine)
npm run test:e2e:browsers        # optional: Chromium + WebKit (+ Firefox where it runs)
```

## 2. Pending migrations

```bash
git diff --stat origin/main -- supabase/migrations   # what is new in this release
```
Migrations must be **additive / backward compatible** (old app keeps working on the new schema),
because the database is migrated before the new app goes live. Never edit an applied migration.

## 3. Development

```bash
npm run db:target                # must print gdpzavhkblbcxivoaqax (DEVELOPMENT)
npx supabase db push --dry-run   # exactly the expected files, "seeds": []
npx supabase db push
```

## 4. Production database (only after all tests are green)

```bash
echo "PRODUCTION = xakpbtmksxvjmsbipwmj"
npx supabase link --project-ref xakpbtmksxvjmsbipwmj
cat supabase/.temp/project-ref   # must be exactly xakpbtmksxvjmsbipwmj — otherwise STOP
npx supabase migration list --linked   # remote column: only the new ones missing
npx supabase db push --dry-run         # exactly the expected files, no seed — otherwise STOP
npx supabase db push
npx supabase db query --linked "select count(*) from supabase_migrations.schema_migrations"
npx supabase link --project-ref gdpzavhkblbcxivoaqax   # IMMEDIATELY back to development
npm run db:target                                      # must print DEVELOPMENT
```
Never `db reset`, `--include-seed` or `qa:fixtures` against a linked remote project.

## 5. Application

```bash
git push origin main             # push main ALONE first (a same-commit branch push can make
                                 # Vercel build only a Preview)
curl -s https://kaidly.ee/api/health   # wait until "version" = first 12 chars of `git rev-parse HEAD`
git push origin main:phase-2-3-organisations-sites   # then keep the branch level
```

## 6. Smoke

- Public + headers: `docs/MANUAL_SMOKE_TEST.md` (public part takes ~3 min).
- Authenticated and admin: same file (Kenneth's own account).
- Logs: `npx vercel logs --environment production --since 15m --level error` and
  `--status-code 5xx` — both must be empty.

## 7. Rollback or forward-fix

| Situation | Action |
|---|---|
| Bad app release, no migration in it | Vercel → Deployments → previous Production deployment → **Promote** (instant). Check `/api/health` shows the old commit. |
| Bad app release after an additive migration | Promote the previous deployment — the old app works on the newer schema (that is why migrations must be additive). |
| A migration itself is wrong | **Forward-fix** with a new migration; never drop/restore Production to undo a deploy (data written since would be lost). |
| Never | Promote a **Preview** deployment to Production — it was built with the development Supabase settings. |

The deployed commit is always visible at `https://kaidly.ee/api/health` (`version`).
