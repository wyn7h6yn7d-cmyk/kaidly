# KAIDLY — Two-step sign-in (TOTP)

Owner decision 2026-11-20 (security review, item e). Migration `20261121100000_admin_mfa.sql`.
Tests: `supabase/tests/250_admin_mfa.test.sql`, `e2e/mfa.spec.ts` (real TOTP codes,
`e2e/support/totp.ts`).

## What users see

- **Everyone:** Konto → "Kaheastmeline sisselogimine" → Lülita sisse → `/auth/kaheastmeline`:
  scan the QR code (or type the key) into an authenticator app, enter the 6-digit code.
  From then on, signing in asks for the code after the password. Turning it off is on the
  same account section.
- **Platform admins:** required. `/admin` without a two-step session goes to
  `/auth/kaheastmeline?next=/admin` ("…on kohustuslik").

## How it is enforced

| Where | Rule |
|---|---|
| Database | `private.session_active()` (inside `org_ids`, `org_ids_readable`, `viewer_site_ids`): a user with a **verified** factor counts as signed in only with JWT `aal = 'aal2'`. A password-only session sees no company data and cannot write. |
| Database | `private.is_platform_admin()`: an admin with `platform_admins.mfa_required` (default true) is an admin only with `aal2` — every `admin_*` RPC answers `not_found` otherwise. |
| App | `requireUser()` redirects a pending second step (`my_mfa_pending()`) to `/auth/kaheastmeline`; `/admin` uses `my_admin_mfa_status()` to send admins there. |

The proxy does not check this: `@supabase/ssr` keeps the user (and its factors) out of the
session cookie, so the check runs in the database and in `requireUser()`.

## Hosting

- Local: `supabase/config.toml` `[auth.mfa.totp] enroll_enabled = true, verify_enabled = true`.
- Hosted (Development and Production): Supabase Dashboard → Authentication → Multi-Factor →
  **TOTP: Enabled** (Supabase's default). Check it before relying on it; if TOTP is off,
  admins cannot enrol and the admin console stays closed (see recovery).

## Recovery (lost authenticator)

- Regular user: the database owner removes the factor —
  `delete from auth.mfa_factors where user_id = '<id>';` — then the user signs in with the
  password and can enrol again.
- Platform admin: as above, or temporarily
  `update private.platform_admins set mfa_required = false where user_id = '<id>';`
  and back to `true` after re-enrolling. Both only through the SQL editor / database owner.
