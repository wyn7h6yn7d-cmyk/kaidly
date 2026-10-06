# KAIDLY — Plans, limits and manual subscriptions

Migration `20261007100000_subscription_plans.sql`. Tests: `supabase/tests/210_subscription_plans.test.sql`,
`scripts/test-plan-concurrency.mjs`, `e2e/subscriptions.spec.ts`, `e2e/pricing.spec.ts`,
`tests/unit/plans.test.ts`.

## 1. Model

A subscription belongs to the **company** (organisation), never to a user. It extends the
existing access row `private.organisation_access` — there is no second access system:

| Concept | Where |
|---|---|
| Trial (14 days, every feature, no card; 1 user, 5 active installations) | `trial_started_at`, `trial_ends_at` (unchanged); limits set at creation |
| Paid period | `full_access_from` … `full_access_until` (unchanged meaning) |
| Plan | `plan` (`start`, `team`, `pro`, `business`, `custom`), `plan_label` (Custom) |
| Agreed price (EUR / month, VAT excl.) | `monthly_price` — admin only |
| Limits | `user_limit`, `installation_limit` — **null = no limit** |
| Internal billing note, invoice reference | `admin_notes`, `invoice_reference` — admin only |
| Status | derived by `private.organisation_access_state()`: trial / active / expired / deactivated |

Fixed plans (`private.subscription_plans`, mirrored for display in `lib/plans.ts`, kept equal
by a unit test):

| Plan | € / month + VAT | Users (total) | Active installations |
|---|---|---|---|
| Start | 19 | 1 | 5 |
| Team | 29 | 3 | 10 |
| Pro | 39 | 5 | 25 |
| Business | 89 | 15 | 100 |
| Custom | agreed | set by admin | set by admin |

Every plan has every feature; plans differ only by the two limits.

## 2. Limits (enforced in the database)

- **Users** = every member (owner, admin, operator, viewer) **+ every live invitation**
  (not accepted, not revoked, not expired). The owner counts. A removed member, a revoked
  or expired invitation frees the seat at once; authored records stay (nothing is deleted).
  - new invitation: refused when it would exceed the limit (`plan_user_limit`);
  - new member (accepting an invitation, any insert path): refused when members would exceed
    the limit — so an invitation accepted after the limit was lowered is refused safely;
  - role changes never change the count; the last owner can never be removed (unchanged).
- **Active installations** = not archived. A new installation, or bringing an archived one
  back, is refused when it would exceed the limit (`plan_installation_limit`); archiving
  frees capacity; CSV import is all-or-nothing as before.
- Both checks are BEFORE triggers that lock the company's access row first, so concurrent
  requests are serialised: two requests can never both take the last seat or slot
  (`scripts/test-plan-concurrency.mjs`, mutation-tested).
- Over the limit (e.g. after a downgrade): nothing existing is touched; only actions that
  would add are refused. The app shows a plan-limit notice instead of the invitation form /
  new-installation form, with links to pricing and to KAIDLY (`KAIDLY_CONTACT_EMAIL`).

## 3. Defaults and existing companies

- **The trial is personal** (`private.user_trials`, one row per user): it starts when a user
  creates their **first** company and lasts 14 days. Every company that user creates gets
  the same trial end — a second company only the remaining time; after the trial has ended a
  new company starts **expired (read-only)** until a platform admin activates a plan; it is
  never silently unlimited. Deleting a company does not reset the trial; being invited to
  someone else's company never starts or uses it (an invited user still gets their own trial
  when they create their first company); ownership changes never touch trial dates. The row
  is locked while a company is created, so concurrent creation cannot produce two trials
  (`scripts/test-plan-concurrency.mjs`). The client never supplies trial data; "Uus
  ettevõte" shows what the new company will get (`my_trial()`).
- **Trial limits:** every feature, **1 user** (the owner) and **5 active installations** —
  no invitations during the trial; assigning any plan replaces the trial limits.
- Companies created by the database owner (seed, fixtures, support) get a company trial
  without limits. Users who created companies before this migration have their trial dated
  from their earliest company (it only affects companies they create from now on).
- **Companies that existed before the migration:** unchanged — no plan, no limits, their
  current trial/full access untouched. Nothing became read-only. Assign plans in
  Platform Admin → Tellimused when invoicing starts.
- Expiry (trial or paid) → read-only exactly as before (viewing and exports keep working);
  activating a paid period restores write access immediately.

## 4. Paid periods

`admin_set_subscription(org, plan, label, price, users, installations, months, paid_until, start)`
and the identical read-only `admin_subscription_preview(...)`:

| Input | Result |
|---|---|
| months (1, 3, 6, 12, 24) on an **active** subscription | **extend** from the current paid-until day |
| months on a trial / expired company | **activate** from the start date (default: today, Tallinn) |
| exact paid-until date | active: change the end (**set_until**); otherwise activate until that day |
| neither | **plan_only**: change plan/limits, dates untouched |

Calendar months: a month-end stays a month-end (31.12.2026 + 6 = 30.06.2027; 30.11 + 1 = 31.12),
other days keep their number, clamped (31.01 + 1 = 28/29.02). "Kehtib kuni D" means access
until the end of D in Tallinn. Legacy indefinite full access is shown as "Tähtajatu"; adding
months to it starts a paid period today.

Every change is in the admin audit log (`subscription_set`, with before/after snapshots of
plan, limits, price, paid-until) and shown as history on the Tellimused screen.

## 5. Platform Admin → Tellimused

`/admin/tellimused` (menu "Tellimused"): all companies, search (name, slug, Custom label),
filters (status, plan, no plan, ending within 14 days), plan, status, trial end, paid-until,
users and active installations against their limits. Shortcut from Ettevõtted → company →
"Halda tellimust".

`/admin/tellimused/<company>`:

1. current plan, status, price, usage, start, paid-until, trial end, invoice reference, note;
2. plan select (fixed plans show their price and limits; Custom asks for name, agreed price,
   user limit, active installation limit), period (none / 1 / 3 / 6 / 12 / 24 months /
   exact date), start date for a new activation;
3. **Vaata üle** → summary calculated by the database (mode, plan, price, limits, period,
   start, "Kehtib kuni"; warnings if current usage exceeds the new limits) → **Kinnita ja
   rakenda** → confirmation dialog → saved. If anything changed meanwhile, nothing is saved
   ("stale"), so a double click cannot extend twice;
4. invoice reference and internal note (admin only), trial extension, "Lõpeta ligipääs";
5. history: previous → new plan, paid-until, limits, who, when.

Only platform admins: every admin RPC calls `private.require_platform_admin()` (others get
`not_found`), the tables are in `private` (no API access), `/admin` renders the ordinary 404
for everyone else.

## 6. What customers see

Settings → **Pakett** (every member): plan name (or "Pakett valimata"), status, users and
active installations against the limits, "Kehtib kuni" / "Prooviperiood kuni", links to
pricing and to KAIDLY. From `organisation_plan(org)` — no price, no invoice reference, no
note. Members page shows "Kasutajad: x / y" to admins. Nobody but a platform admin can
change plan, limits or dates.

## 7. Production rollout

1. Apply the migration (additive; existing companies keep working unchanged).
2. Deploy the app.
3. Tellimused: assign plans to paying companies as invoices are paid.
