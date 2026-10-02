# KAIDLY — Database and security model

Describes the **implemented** schema (Phases 1–6). The source of truth is
`supabase/migrations/`; this document is updated in the same commit as any migration.

| Migration | Phase |
|---|---|
| `20261001152559_foundation.sql` | 1 — privileges lockdown, `private` schema, shared triggers, profiles |
| `20261001155227_organisations.sql` | 2 — roles, organisations, members, invitations, history |
| `20261001161757_sites_installations.sql` | 3 — sites, electrical installations |
| `20261001172308_installation_identifier_per_site.sql` | 3 — identifier unique within a site |
| `20261001172710_operating_log.sql` | 4 — operating log (käidupäevik) |
| `20261001173932_operating_plan.sql` | 5 — operating plan (käidukava) |
| `20261001174810_deficiencies.sql` | 6 — deficiencies (puudused) |

All migrations are applied to the **local** database only. None has been pushed to the
hosted development project yet.

---

## 1. Rules

1. Every change is a migration (`npx supabase migration new <name>`). No manual dashboard changes.
2. RLS is enabled in the migration that creates a table, with explicit grants. New tables get
   **no** privileges by default (foundation migration): `anon` gets nothing on any object;
   `authenticated` gets exactly what each migration grants; functions are not executable
   unless granted. `service_role` has no table privileges either, so a leaked service key
   could not read tenant data through the Data API.
3. Tenant isolation is enforced in the database. The app filters by organisation for
   convenience only.
4. The app never uses the `service_role`/secret key. Operations needing elevated rights are
   `security definer` functions with `set search_path = ''` and an explicit role check.
5. Records that matter are never silently changed or deleted: the operating log is
   append-only, deficiencies are never deleted, everything else is archived.
6. A migration already applied outside a developer machine is never edited.

## 2. Entity overview

```
auth.users ─1:1─ profiles
                   │ n:m (organisation_members.role)
organisations ─────┤
  ├── organisation_invitations           (hashed single-use tokens)
  ├── activity_history                   (written by triggers only)
  └── sites
        └── electrical_installations
              ├── log_entries            (append-only; corrections are new rows)
              │     ↑ completion entries  ← scheduled_activities
              │     ↑ resolution entries  ← deficiencies
              ├── scheduled_activities
              ├── deficiencies
              └── documents              (metadata; files in the private Storage bucket)
                    → optional link to one log entry or one deficiency
                    (organisation- and site-level documents leave installation/site empty)
```

Every tenant table carries `organisation_id`. Child tables also carry `site_id` where the
brief requires it. Consistency is enforced with **composite foreign keys**:
- `(site_id, organisation_id)` → `sites (id, organisation_id)`;
- `(electrical_installation_id, organisation_id)` and `(electrical_installation_id, site_id)` → `electrical_installations`;
- links into `log_entries`, `scheduled_activities` and `deficiencies` go through `(id, electrical_installation_id)`.

As a result, no row can point at another tenant's site or installation, or at the wrong
site within the same tenant, whatever the application sends.

`on delete restrict` everywhere below organisations: nothing with operating history can be
deleted, and an installation with records cannot be moved to another site
(`has_dependent_records`).

## 3. Roles and helpers

`org_role`: `owner` (Omanik) · `admin` (Administraator) · `operator` (Käitaja) · `viewer` (Vaataja).
A user may belong to several organisations with one role in each.

Helpers live in `private`, a schema not exposed through the Data API. All are
`security definer` with `search_path = ''`:

| Function | Callable by users | Purpose |
|---|---|---|
| `role_rank(org_role)` | no | owner 4 … viewer 1 |
| `org_ids(min_role)` | yes | organisation ids where the caller has ≥ `min_role` — used by **every** tenant policy as `organisation_id in (select private.org_ids('…'))` (evaluated once per statement) |
| `has_org_role(org, min_role)` | no | boolean form for RPCs |
| `co_member_ids()` | yes | users sharing an organisation with the caller (profiles policy) |
| `protect_last_owner()` | trigger | an organisation always keeps an owner; locks the organisation row to serialise concurrent changes |
| `record_history()` | trigger | writes `activity_history`; strips `token_hash`; skips no-op updates |
| `handle_new_user()`, `sync_profile_email()` | trigger | maintain `profiles` from `auth.users` |
| `ensure_site_active()` | trigger | no new installation on / move onto an archived site |
| `log_entry_before_insert()` | trigger | recorder from session, name snapshot, `clock_timestamp()`, future-time and archived-installation checks, no correction chains |
| `deficiency_before_insert()` | trigger | recorder from session, future-time and archived-installation checks |
| `next_anchored_due(…)` | no (plain function) | anchored recurrence, §8 |
| `slugify`, `random_suffix`, `invitation_token_hash` | no | helpers |
| `set_updated_at`, `prevent_organisation_change`, `log_entries_append_only`, `scheduled_activity_before_*`, `deficiency_before_update`, `deficiencies_no_delete` | trigger | see the tables below |

## 4. Tables

### profiles
`id` (= `auth.users.id`, cascade), `email` (synced, not user-writable), `full_name` ≤ 200,
`phone` ≤ 40, `preferred_locale` (`et` | `en` | `ru` | null — UI language, migration
`language_preference`). Readable by the user and co-members; the user may update
`full_name`, `phone` and `preferred_locale` of their own row only (column grants).
Profiles are created by the `on_auth_user_created` trigger; users that already existed
when the migrations were applied get theirs from the idempotent `backfill_profiles`
migration (pgTAP: every auth user has a profile).

### organisations
`name` 1–200, `slug` (unique; slugified name + 6 random characters; never changed),
`registry_code` ≤ 30, `contact_email` (≤ 254, checked format), `contact_phone` ≤ 40,
`address` ≤ 300, `notes` ≤ 2000 (migration `company_settings`), `created_by`,
`deactivated_at`, `deactivated_by` (organisation lifecycle, §5a). Slugs are **stable,
non-sequential URL identifiers** — not a security mechanism; access is enforced by RLS.
Created only by `create_organisation()`.

**Company name = mutable display data; slug = stable technical route identifier.** Renaming
never regenerates the slug (`slug` has no update grant; pgTAP `000`, `020`, `125`), so links,
bookmarks and shared URLs keep working. Owners **and admins** edit name, registry code and
the contact fields (policy `admins update organisation settings`, column grants only for
those six columns); operators and viewers read them; lifecycle columns are only changed by
the owner RPCs (§5a).

### organisation_members
`id`, `organisation_id`, `user_id` (unique pair), `role`, `invited_by`.

### organisation_invitations
`organisation_id`, `email` (normalised), `role`, `token_hash` (sha256 of a 256-bit random
token; the token itself is never stored), `invited_by`, `expires_at` (7 days),
`accepted_at`/`accepted_by`, `revoked_at`/`revoked_by`. One live invitation per email per
organisation (a new one revokes the old). `token_hash` is not selectable.

### activity_history
`organisation_id`, `actor_id` (no FK — survives account deletion), `table_name`,
`record_id`, `action`, `old_data`, `new_data`. Written by triggers on organisations,
members, invitations, sites, installations, scheduled activities and deficiencies.
Readable by admins and owners; nobody writes through the API.

### sites
`name` 1–200, `address` ≤ 300, `description` ≤ 5000, `responsible_person` (free text),
`archived_at`, `created_by`.

### electrical_installations
`site_id`, `name` 1–200, `identifier` (tähis, ≤ 50, optional, **unique within its site**,
case-insensitive), `installation_type` (`building`, `switchboard`, `substation`, `solar`,
`storage`, `charging`, `industrial`, `other`), `location` ≤ 200, `description`, `notes`
(≤ 5000 each), `commissioned_on` (1900–2100; not in the future in the app), `status`
(`in_service` Kasutuses / `out_of_service` Kasutusest väljas), `responsible_person`,
`archived_at`, `created_by`. Archived installations take no new log entries or
deficiencies. **Domain review pending:** type list, statuses, responsible person.

### log_entries — käidupäevik (Phase 4)

| column | notes |
|---|---|
| `organisation_id`, `site_id`, `electrical_installation_id` | composite FKs (§2) |
| `occurred_at` | default now; ≥ 1900; ≤ now + 5 min |
| `entry_type` | `inspection` Kontroll · `maintenance` Hooldus · `switching` Lülitamine · `fault` Rike · `repair` Remont · `measurement` Mõõtmine · `other` Muu — descriptive, not legal classifications |
| `description` | 1–5000, required |
| `result` | ≤ 2000 |
| `performed_by_name` | who did the work (free text; form defaults to the user's name) |
| `created_by`, `created_by_name`, `created_at` | recorder from the session (trigger), name snapshot, `clock_timestamp()`; never client-writable |
| `correction_of_id`, `correction_reason` | set together (§6) |
| `scheduled_activity_id`, `scheduled_due_on` | completion records (§8); server-only |
| `deficiency_id` | resolution records (§9); server-only |

View **`log_entry_current`** (`security_invoker`): one row per original entry with the
values of its newest correction, plus `is_corrected`, `correction_count`, the newest
correction's time, author and reason, and the activity and deficiency links. Lists read
from the view.

### scheduled_activities — käidukava (Phase 5)
`title` 1–200, `description`, `frequency_type` (`once` / `recurring`), `interval_value`
(1–1000) + `interval_unit` (`day`/`week`/`month`/`year`) — both or neither,
`anchor_on` (trigger-owned), `next_due_on` (null only when a one-time activity is done),
`responsible_person_name`, `priority` (`low` Madal / `normal` Tavaline / `high` Kõrge),
`archived_at`, `created_by`.

### deficiencies — puudused (Phase 6)
`title` 1–200, `description` 1–5000, `severity` (`low` Madal · `medium` Keskmine ·
`high` Kõrge · `critical` Kriitiline — descriptive, not legal), `detected_at` (not in the
future), `responsible_person_name`, `due_on`, `status` (`open` Avatud · `in_progress` Töös
· `resolved` Lahendatud), `resolution`, `resolved_at`, `resolved_by`, `resolved_by_name`
(all four set exactly when resolved), `created_by`, `created_by_name`.

### documents — dokumendid ja fotod (Phase 7)
Metadata only — file bytes live in Storage, never in Postgres. `category`
(`audit` Audit · `measurement_protocol` Mõõteprotokoll · `single_line_diagram`
Ühejooneskeem · `operating_plan` Käidukava · `maintenance_report` Hooldusraport ·
`declaration` Deklaratsioon · `manual` Juhend · `photo` Foto · `other` Muu), `title` 1–200,
`original_filename` (display only; no path separators or control characters),
`storage_path` (generated: `{organisation_id}/{document_id}/{random uuid}`, unique, checked),
`mime_type` (PDF, JPEG, PNG, WebP, DOCX, XLSX — no SVG/HTML), `size_bytes` 1 B–25 MB,
`status` (`pending` → `ready` | `failed`), `uploaded_by`, `uploaded_by_name`, `created_at`,
`ready_at` (set exactly when ready), `archived_at`.
Placement: optional `site_id`, `electrical_installation_id` (needs the site), and at most one
of `log_entry_id` / `deficiency_id` (needs the installation); composite FKs as for every
tenant table, including `(log_entry_id, electrical_installation_id)` and
`(deficiency_id, electrical_installation_id)`.

## 5. Permission matrix (enforced by RLS, grants and RPC checks)

V = viewer, Op = operator, A = admin, Ow = owner; "+" = that role and above.

| | read | create | change | delete |
|---|---|---|---|---|
| organisation | V+ | anyone signed in (`create_organisation`) | A+: name, registry code, contact email/phone, address, notes (never the slug); Ow deactivates/reactivates (`deactivate_organisation`, `reactivate_organisation`) | Ow, only without operational history (`delete_organisation`) |
| members | V+ | via invitation | A+ non-owner rows; Ow owner rows; column `role` only | A+ non-owners, Ow owners, anyone themselves; last owner protected |
| invitations | A+ (no `token_hash`) | A+ (`create_invitation`; owner role only by Ow) | revoke: A+ (owner invites: Ow) | — |
| history | A+ | triggers only | never | never |
| sites, installations | V+ | A+ | A+ incl. archive | — (archive) |
| log entries | V+ | Op+ | **never** — Op+ adds corrections | **never** |
| scheduled activities | V+ | A+ | A+ incl. archive; Op+ completes via `complete_scheduled_activity` | — (archive) |
| deficiencies | V+ | Op+ | Op+ fields and open ⇄ in progress; Op+ resolves via `resolve_deficiency`; resolved = final | **never** |
| documents (ready) | V+ | Op+ for installations, log entries and deficiencies; A+ for organisation and site documents | A+: title, category, archive — general documents only; attachments never | **never** (archive) |
| documents (incomplete upload) | — (not listed or readable) | — | `finalize_document` (uploader) | the uploader (cleanup) |

Differences from the original Phase 0 plan, by later briefs: operators may correct any log
entry (not only their own), nobody deletes deficiencies, and the next due date is anchored
(not "completion date + interval").

## 5a. Organisation lifecycle (migration `organisation_lifecycle`)

Retention and privacy-erasure rules are not decided, so an organisation with **operational
history** — any operating-log entry (incl. activity completions), deficiency or document —
is never physically deleted.

| RPC | Who | Behaviour |
|---|---|---|
| `delete_organisation(org, typed name)` | owner (`private.is_owner`) | Name must match exactly (`confirmation_mismatch`). Refused with `organisation_has_history` if any log entry, deficiency or document exists. Otherwise one transaction removes plan activities, invitations, memberships and the organisation (sites, installations and change history cascade); a transaction-local marker lets `protect_last_owner` and `record_history` stand aside for that organisation only. User accounts and profiles are untouched. |
| `deactivate_organisation(org, typed name)` | owner | Sets `deactivated_at`/`deactivated_by`. Nothing is deleted. |
| `reactivate_organisation(org)` | owner | Clears deactivation. |

**Deactivated = read-only, enforced centrally:** `private.org_ids(min_role)` no longer returns a
deactivated organisation for any role above `viewer`, so every write policy and every RPC
role check (`has_org_role`) refuses it; members can still read the preserved data. The
`organisation_member_before_insert` trigger stops anyone joining (`organisation_deactivated`).
There is no direct delete privilege on `organisations`, and `deactivated_at` is not
client-writable. Non-owners and other tenants get `not_found`. The app shows a deactivated
organisation as one notice (owners can restore it) and lists it apart on `/o`.

pgTAP `120_organisation_lifecycle` (31): roles, typed name, each kind of history, no direct
path, write blocking for entries/completions/sites/organisation edits, reads kept, no
joining, isolation, reactivation, user accounts survive — mutation-tested (history check,
deactivation filter, owner check, name check, documents clause).

## 5b. Platform administration (migration `platform_admin`)

KAIDLY's own operator (the SaaS owner) is **not** an organisation role. Organisation roles
never grant it, and it never makes the admin a member of a customer company: tenant RLS is
unchanged, so through the normal app a platform admin sees only their own companies.

| Object | Purpose |
|---|---|
| `private.platform_admins` (`user_id` → `auth.users.id`, `granted_at`, `granted_by`, `active`, `notes`) | who administers the platform — by **user id, never by email**. In `private` (not exposed by the Data API); no grants to `anon`/`authenticated`. |
| `private.admin_audit_log` (`admin_user_id`, `action`, `target_type`, `target_id`, `summary` jsonb, `created_at`) | every admin mutation; summaries hold ids and role names only (no emails, passwords, tokens or customer content — pgTAP checks). |
| `private.is_platform_admin()` | the only authorisation check (`active` row for `auth.uid()`). |
| `private.require_platform_admin()` | raises `not_found` (`P0002`) for anyone else — so the admin functions are indistinguishable from missing ones. |
| `private.bootstrap_platform_admin(email)` | **database owner only** (no execute for API roles): resolves exactly one **confirmed** `auth.users` row by case-insensitive email, refuses none or several, stores its id and logs `platform_admin_granted`. Run once per environment from the CLI (below). |
| `public.am_platform_admin()` | "am *I* an admin?" for the UI (only ever about the caller). |
| `public.admin_overview/users/user/companies/company/deadlines/system/audit_entries` | reads: counts, account metadata (email, name, confirmed, last sign-in, disabled), memberships, usage counts, change *kinds* (table, action, time — never `old_data`/`new_data`), company metadata and counts, deadlines, migration/storage totals. **No document contents, log descriptions or storage paths.** |
| `public.admin_set_member_role`, `admin_remove_member` | membership changes; the last-owner trigger still applies. |
| `public.admin_set_user_disabled(user, bool)` | Supabase Auth's own ban (`auth.users.banned_until` = now + 100 years, like Auth's ban API / null; sign-in then shows `account_disabled`); disabling also deletes the user's `auth.sessions`. An admin can't disable themselves. |
| `public.admin_revoke_sessions(user)` | deletes the user's `auth.sessions` (refresh tokens). |
| `public.admin_password_reset_target(user)` | logs the request and returns the user's own confirmed email; the app then calls the public `resetPasswordForEmail`. Nobody sees or sets a password. |

**No service-role key** is needed or used: elevated work is done by these reviewed definer
functions, which run as the database owner (which may update `auth.users.banned_until` and
delete `auth.sessions`). Revoked sessions lose their refresh token immediately; an access
token already issued stays valid until it expires (Auth `jwt_expiry`, 1 h by default),
because the app verifies JWTs locally — documented in the UI copy.

**Deadlines** (`admin_deadlines`): activities with `next_due_on` ≤ today + 14 that are not
archived, and **open** `high`/`critical` deficiencies; deactivated companies only when asked
(`p_include_deactivated`); filters company, site, kind, severity, overdue/soon, period. Only
dates customers entered — no invented legal deadlines.

**Bootstrap (per environment, by the database owner):**
`npx supabase db query --linked "select private.bootstrap_platform_admin('<email>')"`. It
stops with an error if the account is missing, unconfirmed or ambiguous.

pgTAP `130_platform_admin` (57): API roles can't reach the tables or the bootstrap; owners
get `not_found` from every admin function; bootstrap refuses unknown/unconfirmed emails and
is case-insensitive; reads match real counts and carry no credential fields or log content;
the admin sees nothing through normal RLS; every filter of the deadline view; archived,
far-future, resolved and medium items excluded; mutations work, the last-owner rule holds,
self-disable refused, Auth ban and session rows changed; every successful mutation audited
and refused ones not; inactive admins refused. Mutation-tested (inactive flag ignored, org
owner treated as admin, audit removed, bootstrap granted to users). pgTAP
`125_company_settings` (11) covers the company-settings role matrix (mutation-tested).

## 5c. Deadline reminders and notifications (migration `activity_reminders`)

**Thresholds** live on the activity: `scheduled_activities.reminder_days smallint[]`
(default `{14}`; 0–365 each, at most 8; 0 = on the due date). Owners and admins set them
(the existing admin update policy plus a column grant); operators and viewers can't. The
schedule (`next_due_on`, anchored recurrence §8) and the reminder schedule are separate.

**Countdown** is never stored. The app derives it from `next_due_on` and the Tallinn
business date (`lib/schedule.ts` `countdown`/`countdownText`).

**`public.notifications`** — one row per user and reminder: `user_id`, `organisation_id`,
`type` (`activity_reminder`), `channel` (`in_app`; `email`/`push` are future values),
`scheduled_activity_id` (composite FK with the organisation), `due_on` (the occurrence),
`threshold_days`, `created_at`, `read_at`. No copied customer content: titles, site and
installation names are joined at read time. **Identity / idempotency:** unique
`(user_id, scheduled_activity_id, due_on, threshold_days, channel)` and
`insert … on conflict do nothing`, so any number of runs creates each reminder once.

**RLS:** users read and update only their own rows, and only while still a member
(`user_id = auth.uid() and organisation_id in org_ids('viewer')`); only `read_at` is
writable; no insert or delete for users; platform admins see nothing here.
`public.my_notifications(unread_only, limit, offset)` is a **security invoker** reader
that joins the activity, site, installation and organisation under the caller's RLS.

**Generation** — `private.generate_activity_reminders(today default business_date(),
activity default all)` (definer, not callable by API roles):
- active activities (`archived_at is null`, `next_due_on` set) of **active** organisations;
- for each occurrence the **tightest threshold already reached** (`min(t) where
  next_due_on - today <= t`): a late or missed run catches up with one reminder instead of
  firing 30, 14 and 7 together; due-today and overdue occurrences without a reminder get one;
- recipients: current members with role **owner, admin or operator** whose Auth account is
  not banned. Viewers are not notified. `responsible_person_name` is free text and not a
  KAIDLY account, so it is **never** matched to a user (limitation; a linked responsible
  member would be a later schema change).
- Runs **daily at 03:15 UTC** (05:15/06:15 Tallinn) via **pg_cron** job
  `kaidly-activity-reminders`, and immediately from trigger `scheduled_activity_reminders`
  when an activity is created, rescheduled, completed, archived or its thresholds change.

**Recurrence:** `complete_scheduled_activity` advances `next_due_on` by the anchored rule;
the trigger then marks unread reminders of the previous occurrence read (they remain as
history) and evaluates the new occurrence. Nothing is copied forward.

**Scheduler choice:** pg_cron over Vercel Cron — it runs inside the database next to the
data, needs no public endpoint, shared secret or service-role key, and keeps the tenant
rules in one reviewed SQL function. Retries: a failed day is caught up by the next run
(tightest-reached rule); repeated runs are no-ops (unique identity).

**Business date:** `private.business_date(at)` = date in Europe/Tallinn (same as
`todayInTallinn()` in the app). There is no per-organisation time zone yet; all of KAIDLY
assumes Estonia. Midnight boundaries are tested (21:00 UTC summer / 22:00 UTC winter).

pgTAP `140_activity_reminders` (45): every threshold (30/14/7/1/0), no duplicates on
re-runs, tightest-reached rule, overdue, recurrence (history kept, next occurrence),
removed members, disabled accounts, deactivated organisations, viewers, cross-tenant
read/update, no insert/delete/other columns, generator not callable, operator/viewer
can't change thresholds, range check, cron job, Tallinn midnight. Mutation-tested (role
filter, deactivated filter, ban filter, identity constraint, read policy, trigger).

## 5d. Company access — trial, full access, read-only expiry (migration `organisation_access`)

Commercial access belongs to the **company**, not to a user, and is separate from the
lifecycle (`deactivated_at`). `private.organisation_access` (one row per organisation,
created by trigger on insert; existing companies got a fresh trial when the migration ran):
`trial_started_at`, `trial_ends_at`, `full_access_from`, `full_access_until` (null = indefinite),
`expired_manually_at`, `activated_by`, `invoice_reference`, `admin_notes`. Not exposed to
the API; customers read their own state through `public.organisation_access(org)` (status,
writable, end, expired since — no admin fields).

**State, derived at query time** (`private.organisation_access_state(org, at)`):
deactivated (lifecycle wins) → expired (manual) → active (full access started and not
ended) → trial (`now() < trial_ends_at`) → expired. **Expiry rule: exact timestamp**, the
trial ends exactly 14 × 24 h after the company was created (database `now()`); no cron is
involved. The UI shows the end date/time (Tallinn) and whole calendar days left.

**Enforcement:** `private.org_ids(min_role)` requires, for every role above viewer,
`deactivated_at is null and private.can_company_write(org)` (trial or active). Every write
policy and — through `has_org_role()` — every write RPC and insert trigger therefore
refuses an expired company; reads at viewer level are untouched. The two admin-level
**read** policies (change history, invitations) use `private.org_ids_readable(min_role)`
(same rule without the access check). Not affected while expired: reading everything,
own notifications (read/mark read), leaving the company, own account; the owner's
`delete_organisation` / `deactivate_organisation` / `reactivate_organisation` (they use
`private.is_owner`). Reminder generation continues for expired (not deactivated) companies
so users still see what is becoming due; completing needs restored access.

**Platform admin** (all `require_platform_admin()`, all audited with before/after state —
no emails, no secrets): `admin_set_full_access(org, until|null, invoice_reference, notes)`
(activate, set a date, indefinite, or restore after expiry), `admin_extend_trial(org, new end)`
(must be later than the current end; the trial start is never changed),
`admin_expire_access(org)`, `admin_set_access_reference(org, …)`, reads
`admin_company_access`, `admin_access_overview`, `admin_company_access_list(filter)`.
Customers can't read or change any of it (owner ≠ platform admin).

**90 days after expiry:** flagged (`expired_90`, admin filter "Aegunud 90+ päeva"); nothing is
deleted automatically. An empty company may be deleted by its owner under §5a; a company
with history can only be deactivated. Users are never deleted because a company expired.

pgTAP `150_organisation_access` (56): 14-day trial, exact boundary, trial writes, every
blocked write path (log, completion, resolution, deficiencies, documents, sites,
installations, plan/thresholds, invitations, roles, company details), reads and history kept,
multi-company, no customer access to the table/helpers/admin RPCs, cross-tenant, reminders,
owner deactivate/reactivate, extension, activation with date / indefinite, manual expiry,
restore, audit trail, 90-day flag, nothing deleted. Mutation-tested (no access check in
`org_ids`, history through `org_ids`, never-expiring helper, readable table).

## 5e. Global search (migration `global_search`)

`public.search_kaidly(query, entry_types, per_group)` is **SECURITY INVOKER**: every table it
reads is filtered by the caller's own RLS, so search returns nothing the user could not
open anyway. It returns up to `per_group` (default 6, max 25) results per group: companies
(name), sites (name, address), installations (name, identifier), operating-log entries
(description, result, performer; plus entry types the app matched from localised labels —
corrections link to their original), activities (title), deficiencies (title, description)
and **ready** documents (title, original filename). No storage paths, tokens or internal
notes are searched or returned. Deactivated companies are left out (their pages only show
the deactivation notice); expired (read-only) companies stay searchable. Queries under two
characters return nothing; `%`, `_` and `\` are literal. Trigram GIN indexes
(`pg_trgm`) exist on exactly the searched text columns, because substring `ILIKE` cannot
use B-tree indexes.

Reports (ARCHITECTURE.md §6g) need no schema: they read the existing tables through RLS.

pgTAP `160_global_search` (20): every entity and field, localised entry types, literal
wildcards, unfinished uploads excluded, minimum length, other tenants and outsiders find
nothing, expired searchable, deactivated left out, multi-company. Mutation-tested
(SECURITY DEFINER makes the isolation tests fail).

## 5f. Release hardening (migration `release_hardening`)

**Upload abuse protection.** Trigger `zz_document_upload_limits` (BEFORE INSERT on
`documents`, after `document_before_insert`) counts every upload registration in
`private.upload_events` — so abandoned, failed or deleted attempts still count — and raises
`upload_rate_limited` when a limit in `private.upload_limits` (one row, change with SQL, no
deploy) would be exceeded. Defaults: per user 100 per hour, 400 and 4 GB per 24 h, 30
unfinished uploads at once; per company 1500 and 15 GB per 24 h. Registrations of one user
are serialised (advisory lock). Storage uploads need a registered pending row, so direct
API calls are covered. Daily pg_cron job `kaidly-upload-events-cleanup` (`40 3 * * *`)
drops counters older than 3 days. This is abuse protection, not a commercial storage quota.

**Immediate revocation.** `private.session_active()` — the request's Auth session
(`session_id` claim) must still exist in `auth.sessions` and the account must not be banned —
is part of `private.org_ids()` and `private.org_ids_readable()`. Revoking sessions, "sign out
other devices", a password change or a platform-admin disable therefore removes all
company read and write access on the next request (worst case: one in-flight request), even
though the access token itself stays valid until its expiry. Tokens without `session_id`
(maintenance, tests that set claims) have no session to check.

The two write paths outside `org_ids()` — creating a company and joining one — are guarded
by trigger `a_require_live_session` (`private.require_live_session()`, migration
`session_guard_inserts`) on `organisations` and `organisation_members`. What a revoked
token can still do until it expires: read/update its own profile row and see the
(empty) signed-in frame.

pgTAP `170_release_hardening` (20): hourly, daily-bytes, company and configurable limits;
deleting pending uploads doesn't reset counters; per-user isolation; limits not readable by
users; live vs revoked session; banned account; cleanup job. Mutation-tested.

## 6. Operating log — append-only and corrections

- There are no update or delete grants or policies for any role, and trigger
  `log_entries_no_update_delete` plus a TRUNCATE trigger reject changes even from the table
  owner.
- A correction is a **new row** with `correction_of_id` pointing at the **original** entry. A
  trigger rejects pointing at a correction, so there are no chains: each original has one
  flat, time-ordered list of corrections. The composite FK
  `(correction_of_id, electrical_installation_id)` keeps it in the same installation, and
  therefore the same site and organisation.
- A correction carries the full corrected content and a mandatory reason. Who and when are
  recorded like any entry. The **newest** correction is the current state; the original
  and every correction stay readable (UI: "Parandatud" mark plus a history list).
- Completion and resolution links stay on the original; corrections never carry them.

## 7. RPCs (`public`, executable by `authenticated` only)

| Function | Who | Behaviour |
|---|---|---|
| `create_organisation(name, registry_code)` | anyone signed in | org + owner membership; returns slug |
| `create_invitation(org, email, role)` | A+ (owner role: Ow) | refuses existing members; revokes the previous live invite; stores the hash; returns the token once |
| `revoke_invitation(id)` | A+ | same `not_found` for foreign and unknown ids |
| `invitation_preview(token)` | signed in | only the status unless the invitation is live; then organisation name, role, expiry, email match |
| `accept_invitation(token)` | invitee | row lock; revoked → used → expired → confirmed email → email match → not a member; inserts the membership with the stored role |
| `complete_scheduled_activity(activity, due_on, entry_type, occurred_at, description, result, performed_by)` | Op+ | §8 |
| `resolve_deficiency(deficiency, resolution, entry_type, occurred_at, performed_by)` | Op+ | §9 |
| `delete_organisation`, `deactivate_organisation`, `reactivate_organisation` | Ow | §5a |
| `finalize_document(document)` | the uploader, Op+ | §10: `ready` if the object exists at the registered path with the registered size and type, else `failed` |
| `am_platform_admin()`, `admin_*` | platform admins (others: `not_found`) | §5b |
| `my_notifications(unread_only, limit, offset)` | signed in (security invoker: own rows under RLS) | §5c |
| `organisation_access(org)` | members (viewer+) | §5d |
| `search_kaidly(query, entry_types, per_group)` | signed in (security invoker: caller's RLS) | §5e |
| `admin_set_full_access`, `admin_extend_trial`, `admin_expire_access`, `admin_set_access_reference`, `admin_company_access`, `admin_access_overview`, `admin_company_access_list` | platform admins | §5d |

All RPCs return the **same** `not_found` error for "doesn't exist" and "not allowed", so ids
can't be probed. The baseline test pins this exact list.

## 8. Operating plan — anchored recurrence

- Due dates are `anchor_on + k × interval`. `anchor_on` is set by triggers: on insert and
  whenever an admin changes the due date, frequency or interval, it becomes the new
  `next_due_on`.
- `complete_scheduled_activity` locks the activity. It refuses archived activities and any
  `due_on` other than the current `next_due_on` (`activity_already_completed`). It then
  writes a log entry with `scheduled_activity_id` + `scheduled_due_on` and moves
  `next_due_on` to the first anchored date after **both** the completed due date and today
  (Tallinn). A transaction-local flag stops the trigger from re-anchoring.
  - **Completed early:** the next due date is the following occurrence.
  - **Completed late:** missed occurrences are skipped; the schedule keeps its anchor and does
    not restart from the completion date. *Assumption, needs domain review.*
  - **No drift:** 31 Jan → 28 Feb → 31 Mar; 29 Feb 2028 → 28 Feb 2029 → … → 29 Feb 2032.
- Unique `(scheduled_activity_id, scheduled_due_on)` on log entries: one completion per due
  date, even when two people submit at once.
- **Derived status, not stored** (`lib/schedule.ts`): Üle tähtaja (`next_due_on < today`),
  Varsti (within 14 days), Tulemas (later), Tehtud (one-time, `next_due_on` null).
- Completion history is the operating log itself: immutable, correctable like any entry.

## 9. Deficiencies — lifecycle

`open ⇄ in_progress → resolved`.
- Resolving goes only through `resolve_deficiency`: row lock; refuses an already resolved
  deficiency; requires a resolution note; writes a log entry (`deficiency_id`, description =
  resolution, default type Remont) and records who resolved it and when — one transaction.
  The log entry is unique per deficiency.
- A resolved deficiency is **final** (`deficiency_resolved`). A plain update to `resolved` is
  refused (`deficiency_resolve_via_rpc`). A recurring problem is recorded as a new deficiency.
  Reopening is an open product question.
- Deficiencies are never deleted (no grant, no policy; delete and truncate triggers).
- Every change, including each status transition, is in `activity_history` with the acting
  user and the previous state.

## 10. Storage — documents and photos (Phase 7)

**One private bucket `documents`** (`public = false`, 25 MB limit, the same six MIME types as
the table). No public URLs; files are read through **60-second signed URLs** created for
the signed-in user by the route `/o/[org]/dokumendid/[id]/ava`.

**Upload lifecycle**
1. *Register* (server action → insert into `documents` as the user). The insert trigger
   generates `storage_path`, forces `pending`, records the uploader, and refuses archived
   installations, resolved deficiencies and closed log entries.
2. *Upload* — the browser sends the bytes straight to Storage with the user's session
   (`x-upsert: false`). The INSERT policy only accepts a path that is the caller's own
   **pending** document, so paths can't be forged or pointed into another tenant.
3. *Finalize* — `finalize_document` compares the object's size and type with the row and
   sets `ready` or `failed`. Only `ready` documents are listed or readable.
4. On failure the client deletes its own object and pending row (allowed only for
   non-ready rows of the uploader). No background worker; leftovers are reported by the
   read-only `supabase/maintenance/storage_report.sql`.

**Storage policies on `storage.objects`** (exactly three; the baseline pins them):
| Policy | Rule |
|---|---|
| read ready files (SELECT) | a `ready` documents row with this path is visible to the caller (documents RLS applies) |
| upload registered pending files (INSERT) | a `pending` row with this path, uploaded by the caller |
| remove own incomplete uploads (DELETE) | a non-ready row with this path, uploaded by the caller |

No UPDATE policy: objects are never overwritten or replaced. Nothing for `anon`.

**Immutability**
- Files on a log entry or a deficiency are part of the operational record: the row can't
  be changed, archived or deleted (`document_immutable`, `documents_are_kept`, check
  constraint) and the object can't be deleted or overwritten.
- New files go onto a log entry only from its author within **24 hours** of recording it
  (approved 2026-10-02, migration `attachment_window_24h`)
  (`log_entry_attachment_closed`) — enough to finish uploads from site. Later material goes
  on a **correction** entry (corrections are new log entries); the original's files stay.
- Deficiencies accept files until resolved (`deficiency_resolved`); then they are final.
- Completed activities: files go on the completion's log entry (no separate link).
- General documents (organisation, site, installation) can be renamed, recategorised and
  **archived/restored** by admins; never deleted. Archived documents stay readable.
- Ready rows can't be deleted even by the table owner (trigger), and TRUNCATE is refused.

Errors never reveal another organisation's objects: foreign and unknown documents both
give 404 / `not_found`.

**No cross-tenant oracles in triggers** (migration `harden_insert_triggers`). Security
definer BEFORE triggers run before RLS and the foreign keys. Each one therefore first
refuses non-members of the row's organisation with the plain RLS error, and scopes every
lookup to `new.organisation_id`. Naming another tenant's record gives the generic
foreign-key error whether or not it exists, and whatever its state. New definer triggers
must follow the same pattern.

## 10a. Dashboard view (Phase 8)

`public.site_attention` (`security_invoker`): one row per **active** site with
`overdue_activities`, `due_soon_activities` (today … today + 14, Tallinn), `open_deficiencies`
and `serious_deficiencies` (high/critical, not resolved). Because it runs with the caller's
rights, every count comes through RLS — a member of two organisations sees each
organisation's own numbers. `select` for `authenticated` only. Partial indexes
`scheduled_activities_site_due_idx` and `deficiencies_site_open_idx` back the counts.
The dashboard's other sections are bounded queries (`limit 5` + exact count) on the tables.

## 10b. Change history read model

`activity_history` (written by triggers, admin+ read, token hashes stripped at write time)
is shown at `/o/[org]/seaded/ajalugu`. `lib/history.ts` turns rows into events and only
ever names allowlisted fields; document upload bookkeeping (pending inserts, failed-upload
deletes) is filtered in the query. No schema change was needed.

## 11. Tests

`npm run test:db` runs pgTAP: 633 tests in 19 files, using the shared fixture
`supabase/tests/helpers/fixture.psql` (two tenants with one user per role, an outsider, and
a user in both) and `helpers/sites.psql`.

| File | Tests | Covers |
|---|---|---|
| `000_security_baseline` | 20 | RLS on every table; nothing for anon; no TRUNCATE/REFERENCES/TRIGGER for users; `security_invoker` views; `search_path` on definer functions; **review gates** — exact table list, exact definer-function list, exact RPC list, every tenant policy through `org_ids`, select policy on every tenant table, no write paths into append-only/never-deleted tables, server-owned columns not writable, no public buckets, **exact bucket set and settings, exact storage policy set, every storage policy limited to the bucket** |
| `010_foundation` | 17 | profiles, triggers |
| `020_organisations` | 48 | role matrix, isolation, last owner, joins, history |
| `030_invitations` | 41 | hashing, expiry, single use, revocation, email binding, cross-tenant RPC calls |
| `040_sites_installations` | 58 | isolation by id/filter/join, forged ids, cross-tenant FKs, roles, archive, identifier rule |
| `050_log_entries` | 44 | append-only for every role and the owner, corrections, forged and mismatched ids |
| `060_scheduled_activities` | 46 | roles, completion → log, anchored dates, duplicates, one-time, archived |
| `070_deficiencies` | 39 | roles, lifecycle, resolution → log, no double resolution, no deletion, history |
| `080_documents` | 44 | metadata isolation, roles (viewer can't upload, operator scope, admin-only general documents), forged/foreign paths and parents, SVG/size/filename rules, attachment window (23 h allowed, 25 h refused), storage read/upload/overwrite/delete across tenants, pending objects unreadable, finalize (missing object, size mismatch, foreign caller), historical files immutable and undeletable, archive/restore, anon reads nothing |
| `090_dashboard` | 12 | `site_attention` counts, isolation per role, member of two organisations, outsider and anon, archived sites, `security_invoker` |
| `100_cross_tenant_oracles` | 9 | naming another tenant's archived/resolved/correction records gives the generic FK error, non-members get the plain RLS error, Storage refuses another tenant's existing path like an unknown one and lists nothing |
| `110_language_and_history` | 14 | own language only (even viewers), only et/en/ru, no other profile column opened, anon refused; change history readable by owners/admins of the same organisation only — not operators, viewers, outsiders, a two-organisation non-admin or anon — and never containing token hashes |
| `120_organisation_lifecycle` | 31 | §5a |
| `125_company_settings` | 11 | owners and admins edit company details, operators/viewers read only, slug and lifecycle columns not writable, email format, other tenant, deactivated company |
| `130_platform_admin` | 57 | §5b |
| `140_activity_reminders` | 45 | §5c |
| `150_organisation_access` | 56 | §5d |
| `160_global_search` | 20 | §5e |
| `170_release_hardening` | 20 | §5f |

Every protection has been **mutation-tested**: deliberately breaking a policy, trigger,
grant or function made the relevant tests fail, and everything was restored afterwards.

## 12. Local development

```bash
npm run db:start     # local Supabase (Docker-compatible runtime)
npm run db:reset     # rebuild from migrations + local seed (supabase/seed.sql)
npm run test:db
npm run db:types     # regenerate lib/supabase/database.types.ts
```

The seed is fictional demo data for local use only (README). `supabase db push` never runs it.
