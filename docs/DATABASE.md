# KAIDLY — Database and security model

Status: **approved 2026-10-01**. The SQL in this document is a design sketch for tables
that don't exist yet. The source of truth is the migration files in
`supabase/migrations/`; this document is updated in the same commit whenever a migration
changes the model. Implemented so far: §8 (Phase 1 foundation).

---

## 1. Rules

1. **Every change goes through a migration** (`supabase migration new <name>`). No manual
   changes in the Supabase dashboard — not tables, not policies, not buckets. If something
   was changed by hand in an emergency, a migration reproducing it is written the same day.
2. **RLS is enabled in the same migration that creates the table.** A table never exists
   without policies, not even briefly.
3. **Tenant isolation lives in the database.** The app filters by organisation for
   convenience; the database enforces it. A bug in a page must not be able to leak data.
4. **The app never uses the `service_role` / secret key.** All requests run as the signed-in
   user with the publishable key, so RLS always applies. Operations that need elevated
   rights are `security definer` functions with explicit permission checks inside.
5. UUID primary keys (`gen_random_uuid()`), `timestamptz` everywhere, `created_at` /
   `updated_at` on every mutable table, explicit foreign keys and check constraints,
   indexes for every foreign key and every list query.

## 2. Entity overview

```
auth.users ──1:1── profiles
                      │
                      │ n:m (organisation_members: role)
                      │
organisations ────────┤
   │                  └── organisation_invitations
   ├── sites
   │     └── electrical_installations
   │            ├── log_entries ◄──────────────┐
   │            ├── scheduled_activities ──────┤ completing writes a log entry
   │            ├── deficiencies ──────────────┘ resolving writes a log entry
   │            └── documents (also on site, log entry, deficiency)
   └── activity_history (written by triggers only)
```

Every tenant table carries `organisation_id`, even when it could be derived through a
parent. This keeps every RLS policy a single, indexable check and avoids join chains.
Consistency of the denormalised `organisation_id` is guaranteed by **composite foreign
keys** (see §4), not by application code.

`organisation_invitations` is not in the original concept list. It is needed so that an
admin can add a person who does not have an account yet (decision D4 in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#decisions)).

## 3. Enums

```sql
create type public.org_role            as enum ('owner', 'admin', 'operator', 'viewer');
create type public.installation_kind   as enum ('building', 'switchboard', 'substation',
                                                'solar', 'storage', 'charging', 'industrial', 'other');
create type public.voltage_level       as enum ('low', 'medium', 'high');      -- madal-, kesk-, kõrgepinge
create type public.log_entry_type      as enum ('inspection', 'switching', 'maintenance',
                                                'measurement', 'fault', 'note');
create type public.deficiency_severity as enum ('minor', 'major', 'dangerous');
create type public.deficiency_status   as enum ('open', 'in_progress', 'resolved');
create type public.interval_unit       as enum ('day', 'week', 'month', 'year');
create type public.document_kind       as enum ('scheme', 'protocol', 'certificate',
                                                'manual', 'photo', 'other');
```

Entry types, installation kinds and severity levels need domain review before Phase 3
(see PRODUCT.md §8). Enums are cheap to extend but awkward to shrink, so start small.

## 4. Tables

Column lists are complete for the MVP; types are indicative. `…timestamps` means
`created_at timestamptz not null default now(), updated_at timestamptz not null default now()`
with a shared `updated_at` trigger.

### profiles
One row per auth user, created by a trigger on `auth.users` insert.

| column | type | notes |
|---|---|---|
| id | uuid PK | `references auth.users on delete cascade` |
| email | text | copied from `auth.users` by trigger, kept in sync; not user-updatable (nullable only because `auth.users.email` is) |
| full_name | text | `check (char_length(full_name) <= 200)` |
| phone | text | optional, ≤ 40 chars |
| …timestamps | | |

Email is copied here so that members of the same organisation can see each other's
email without any access to `auth.users`.

### organisations

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text not null | `check (char_length(name) between 1 and 200)` |
| slug | text not null unique | `check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60)`; used in URLs |
| registry_code | text | Estonian business registry code, optional |
| created_by | uuid | `references profiles on delete set null` |
| archived_at | timestamptz | |
| …timestamps | | |

Created only through `create_organisation(name, slug)` (§6), which inserts the
organisation and the creator's `owner` membership in one transaction.

### organisation_members

| column | type | notes |
|---|---|---|
| organisation_id | uuid | `references organisations on delete cascade` |
| user_id | uuid | `references profiles on delete cascade` |
| role | org_role not null | |
| invited_by | uuid | `references profiles on delete set null` |
| …timestamps | | |

`primary key (organisation_id, user_id)`; index on `user_id`.

Trigger `protect_last_owner`: rejects any update or delete that would leave an
organisation with zero owners.

### organisation_invitations

| column | type | notes |
|---|---|---|
| id | uuid PK | internal only — never in the link |
| organisation_id | uuid not null | `references organisations on delete cascade` |
| role | org_role not null | the role granted on acceptance |
| email | text not null | intended recipient, `check (email = lower(email))` |
| token_hash | bytea not null unique | `sha256(token)`; the plaintext token is never stored |
| invited_by | uuid | `references profiles on delete set null` |
| expires_at | timestamptz not null | default `now() + interval '7 days'` |
| accepted_at | timestamptz | set once; invitation is then spent |
| accepted_by | uuid | `references profiles on delete set null` |
| revoked_at | timestamptz | |
| created_at | timestamptz | |

Checks: `(accepted_at is null) = (accepted_by is null)`; not both accepted and revoked.
Unique partial index on `(organisation_id, email) where accepted_at is null and revoked_at is null`
(one live invitation per person per organisation).

**Token lifecycle** (D4 — copyable link only, no email sending):

1. `create_invitation(organisation_id, email, role)` (admin+; only an owner may invite an
   owner) generates 32 random bytes with `extensions.gen_random_bytes`, stores
   `sha256(token)` and returns the plaintext token **once**. The UI shows the link
   `/invite/<token>` for copying. It can't be shown again; a lost link means revoke and
   re-invite.
2. `/invite/<token>` (public) calls `invitation_preview(token)`, which returns only the
   organisation name, role and expiry — nothing else — for a valid, live token.
3. `accept_invitation(token)` (signed in) hashes the token, locks the row
   (`for update`), and succeeds only if it is not expired, not revoked, not yet accepted,
   and the caller's **confirmed** email equals `email`. It creates the membership with the
   invitation's role and sets `accepted_at` / `accepted_by` in the same transaction. A
   second use fails: the token is single-use.
4. Revoking sets `revoked_at`; the token stops working immediately.

The organisation and role are resolved from the stored row, never from the link, so a
token can't be edited to grant a different role or organisation.

### sites

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| organisation_id | uuid not null | `references organisations on delete cascade` |
| name | text not null | 1–200 chars |
| address | text | |
| notes | text | |
| created_by | uuid | `references profiles on delete set null` |
| archived_at | timestamptz | archive instead of delete |
| …timestamps | | |

`unique (id, organisation_id)` — target for composite FKs.
Index `(organisation_id, name)`.

### electrical_installations

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| organisation_id | uuid not null | `references organisations on delete cascade` |
| site_id | uuid not null | **`foreign key (site_id, organisation_id) references sites (id, organisation_id)`** |
| name | text not null | e.g. "Peajaotuskilp" |
| designation | text | short code on the device, e.g. "PJK-1" |
| kind | installation_kind not null | |
| voltage_level | voltage_level | |
| main_fuse_a | integer | `check (main_fuse_a > 0)` — peakaitse, amperes |
| connection_point_code | text | grid connection / EIC code |
| commissioned_on | date | |
| supervisor_user_id | uuid | käidukorraldaja inside KAIDLY, `references profiles on delete set null` |
| supervisor_name | text | käidukorraldaja who is not a KAIDLY user |
| notes | text | |
| created_by | uuid | |
| archived_at | timestamptz | |
| …timestamps | | |

`unique (id, organisation_id)`, `unique (id, site_id)`.
Indexes `(site_id)`, `(organisation_id, name)`.

The composite FK makes it impossible for an installation in organisation A to point at a
site in organisation B, even if application code tried. The same pattern is used for
every child table below.

### log_entries — käidupäevik

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| organisation_id | uuid not null | |
| installation_id | uuid not null | FK `(installation_id, organisation_id)` → installations |
| entry_type | log_entry_type not null | |
| occurred_at | timestamptz not null | default `now()`; `check (occurred_at <= now() + interval '1 hour')` at insert (trigger) |
| body | text not null | 1–10 000 chars |
| scheduled_activity_id | uuid | set when the entry completes a scheduled activity |
| deficiency_id | uuid | set when the entry records resolving a deficiency |
| corrects_entry_id | uuid | FK `(corrects_entry_id, installation_id)` → `log_entries (id, installation_id)` — this entry corrects an earlier one in the same installation |
| correction_reason | text | required when `corrects_entry_id` is set: `check ((corrects_entry_id is null) = (correction_reason is null))` |
| created_by | uuid | `references profiles on delete set null`; default `auth.uid()` |
| author_name | text not null | snapshot of the author's name at write time |
| created_at | timestamptz not null | |

`unique (id, installation_id)`.
Indexes `(installation_id, occurred_at desc)`, `(organisation_id, occurred_at desc)`.

**Strictly append-only (D3).** No update or delete policies exist, and a trigger rejects
`update` and `delete` on `log_entries` for every role except during organisation deletion,
so nothing can silently change a record — not even through a future bug in a
`security definer` function.

**Corrections:**
- A correction is a new row with `corrects_entry_id` pointing at the **original** entry
  (never at another correction — enforced by trigger, which keeps the chain flat and easy
  to read) and a mandatory `correction_reason`.
- The correction carries the full corrected content (`entry_type`, `occurred_at`, `body`),
  not a diff. The latest correction is the **current state**; the original and every
  earlier correction remain readable.
- Who may correct: the author of the original entry, or an admin/owner.
- A view `log_entries_current` (`security_invoker = true`, so RLS applies) returns one row
  per original entry with the current content, a `corrected` flag, the correction count
  and the time of the latest correction. Lists read from the view; the entry detail reads
  the full chain.
- UI: a corrected entry shows the current content with a clear "Parandatud" marker
  (date, who, reason). Opening it shows the history newest-first, with the original at
  the bottom shown struck through but fully legible. Corrections never appear as separate
  items in the log list.

`author_name` keeps the record readable even if the author's account is later deleted.

### scheduled_activities — käidukava

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| organisation_id | uuid not null | |
| installation_id | uuid not null | FK `(installation_id, organisation_id)` → installations |
| title | text not null | e.g. "Isolatsioonitakistuse mõõtmine" |
| description | text | |
| interval_count | integer | `check (interval_count > 0)` |
| interval_unit | interval_unit | `check ((interval_count is null) = (interval_unit is null))` — both null = one-off |
| next_due_on | date | null once a one-off activity is done |
| last_completed_at | timestamptz | |
| responsible_user_id | uuid | `references profiles on delete set null` |
| created_by | uuid | |
| archived_at | timestamptz | |
| …timestamps | | |

`unique (id, installation_id)`.
Indexes `(organisation_id, next_due_on) where archived_at is null`, `(installation_id)`.

Completed only through `complete_scheduled_activity(...)` (§5.5): writes a log entry linked
to the activity and moves `next_due_on` forward by the interval **from the completion
date**.

**No stored status (D18).** The display state is derived from dates when reading:

| State | Estonian | Rule |
|---|---|---|
| Overdue | Hilinenud | `next_due_on < today` |
| Due soon | Tähtaeg läheneb | `today <= next_due_on <= today + 14 days` |
| Upcoming | Tulemas | `next_due_on > today + 14 days` |
| Completed | Tehtud | one-off activity with `next_due_on is null` (recurring activities show "last completed" alongside their next state) |

"Today" is computed in `Europe/Tallinn`. The 14-day window is one constant in the app.

### deficiencies — puudused

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| organisation_id | uuid not null | |
| installation_id | uuid not null | FK `(installation_id, organisation_id)` → installations |
| found_in_entry_id | uuid | FK `(found_in_entry_id, installation_id)` → `log_entries (id, installation_id)` |
| title | text not null | |
| description | text | |
| severity | deficiency_severity not null | |
| status | deficiency_status not null default 'open' | |
| due_on | date | |
| resolved_at | timestamptz | `check ((status = 'resolved') = (resolved_at is not null))` — `open` and `in_progress` have no resolution |
| resolved_by | uuid | |
| resolution_note | text | |
| created_by | uuid | |
| …timestamps | | |

`unique (id, installation_id)`.
Indexes `(organisation_id, status, due_on)`, `(installation_id, status)`.

Status flow: `open → in_progress → resolved` (`in_progress` optional; operators may move
between `open` and `in_progress` freely). Resolving goes through
`resolve_deficiency(id, note)` (§5.5), which also writes a log entry, so the käidupäevik
remains the complete record. Reopening a resolved deficiency is an admin action and
is recorded in history.

### documents

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| organisation_id | uuid not null | |
| site_id | uuid | FK `(site_id, organisation_id)` → sites |
| installation_id | uuid | FK `(installation_id, organisation_id)` → installations |
| log_entry_id | uuid | FK `(log_entry_id, installation_id)` → `log_entries (id, installation_id)` |
| deficiency_id | uuid | FK `(deficiency_id, installation_id)` → `deficiencies (id, installation_id)` |
| kind | document_kind not null | |
| title | text not null | defaults to file name |
| file_name | text not null | original name |
| storage_path | text not null unique | `check (storage_path like organisation_id::text \|\| '/%')` |
| mime_type | text not null | |
| size_bytes | bigint not null | `check (size_bytes > 0 and size_bytes <= 26214400)` (25 MB) |
| uploaded_by | uuid | `references profiles on delete set null` |
| created_at | timestamptz | |

Checks:
- `num_nonnulls(site_id, installation_id) = 1` — a document belongs to a site **or** an installation.
- `(log_entry_id is null and deficiency_id is null) or installation_id is not null` — entry and deficiency attachments always carry their installation, so the installation's document list includes them.

Indexes on each FK column.

### activity_history

| column | type | notes |
|---|---|---|
| id | bigint generated always as identity PK | |
| organisation_id | uuid not null | `references organisations on delete cascade` |
| actor_id | uuid | `auth.uid()` at the time; `references profiles on delete set null` |
| table_name | text not null | |
| record_id | uuid not null | |
| action | text not null | `check (action in ('insert', 'update', 'delete'))` |
| old_data, new_data | jsonb | |
| created_at | timestamptz not null default now() | |

Indexes `(organisation_id, created_at desc)`, `(table_name, record_id)`.

Written **only** by the generic trigger `private.record_history()` (`security definer`)
attached to every tenant table. No insert/update/delete policies exist, so nobody — not
even an owner — can change history through the API.

## 5. Row Level Security

### 5.1 Helper functions

Live in a `private` schema that PostgREST does not expose. `security definer` so that
policies on `organisation_members` don't recurse; `search_path = ''` so they can't be
hijacked; `stable` so Postgres evaluates them once per statement.

```sql
create schema private;

create function private.role_rank(r public.org_role) returns int
language sql immutable set search_path = '' as $$
  select case r when 'owner' then 4 when 'admin' then 3
                when 'operator' then 2 when 'viewer' then 1 end
$$;

-- Organisations where the current user has at least `min_role`.
create function private.org_ids(min_role public.org_role default 'viewer')
returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organisation_id
  from public.organisation_members m
  where m.user_id = (select auth.uid())
    and private.role_rank(m.role) >= private.role_rank(min_role)
$$;

revoke all on function private.org_ids from public, anon;
grant execute on function private.org_ids to authenticated;
```

Policies are written as `organisation_id in (select private.org_ids('operator'))`. The
sub-select runs once per query instead of once per row, which keeps list pages fast as
data grows.

### 5.2 Baseline for every table

- `alter table … enable row level security;`
- All policies are `to authenticated`. The `anon` role has no table privileges at all.
- A shared trigger rejects any update that changes `organisation_id` (data never moves between tenants).
- `created_by` / `uploaded_by` are forced to `auth.uid()` by the insert policy's `with check`.

### 5.3 Permission matrix

V = viewer, Op = operator, A = admin, Ow = owner. "+" means that role and above.

| Table | select | insert | update | delete |
|---|---|---|---|---|
| profiles | self, or anyone sharing an organisation | trigger only | self (`full_name`, `phone` only — column grant) | via account deletion only |
| organisations | V+ | via `create_organisation()` | **Ow** (settings) | **Ow** via `delete_organisation()`, confirmed by name |
| organisation_members | V+ | via `create_organisation()` / `accept_invitation()` | A+ for non-owner rows; only Ow may grant, change or remove `owner` | A+ for non-owner rows (Ow for owners); anyone may remove **themselves**; last owner protected |
| organisation_invitations | A+ | via `create_invitation()` (A+; only Ow may invite an owner) | A+ (revoke only) | — |
| sites | V+ | A+ | A+ (incl. archive) | — |
| electrical_installations | V+ | A+ | A+ (incl. archive) | — |
| log_entries | V+ | Op+ (corrections: author of the original, or A+) | **never** | **never** |
| scheduled_activities | V+ | A+ | A+ (incl. archive); Op+ completes via `complete_scheduled_activity()` | — |
| deficiencies | V+ | Op+ | Op+ (fields, `open` ↔ `in_progress`); resolve via `resolve_deficiency()`; reopen A+ | A+ |
| documents | V+ | Op+ | A+ (title, kind) | A+ |
| activity_history | A+ | trigger only | never | never |

This is decision D5: operators do operational work but never create, archive or delete
sites or installations and never manage members; admins manage everything except
ownership-sensitive actions; owners have full control.

### 5.4 Example policies

```sql
alter table public.sites enable row level security;

create policy "members read sites" on public.sites
  for select to authenticated
  using (organisation_id in (select private.org_ids('viewer')));

create policy "admins create sites" on public.sites
  for insert to authenticated
  with check (organisation_id in (select private.org_ids('admin'))
              and created_by = (select auth.uid()));

create policy "admins update sites" on public.sites
  for update to authenticated
  using      (organisation_id in (select private.org_ids('admin')))
  with check (organisation_id in (select private.org_ids('admin')));
```

```sql
-- Members: admins manage non-owners; only owners touch owner rows.
create policy "admins update members" on public.organisation_members
  for update to authenticated
  using (organisation_id in (select private.org_ids('admin'))
         and (role <> 'owner' or organisation_id in (select private.org_ids('owner'))))
  with check (organisation_id in (select private.org_ids('admin'))
              and (role <> 'owner' or organisation_id in (select private.org_ids('owner'))));
```

`using` sees the old row and `with check` the new one, so an admin can neither demote an
owner nor promote anyone (including themselves) to owner.

### 5.5 Security-definer functions (RPC)

Each one: `security definer`, `set search_path = ''`, checks the caller's role with
`private.org_ids()` first, raises on failure, does all its writes in one transaction.
`execute` granted to `authenticated` only.

| Function | Who | What |
|---|---|---|
| `create_organisation(name, slug)` | any signed-in user | org + owner membership |
| `create_invitation(organisation_id, email, role)` | A+ (Ow for `owner`) | stores token hash, returns plaintext token once |
| `invitation_preview(token)` | anyone with the link | organisation name, role, expiry — for a live token only |
| `accept_invitation(token)` | invitee | single-use, expiry, revocation and confirmed-email checks; creates membership; marks accepted |
| `correct_log_entry(entry_id, entry_type, occurred_at, body, reason)` | author or A+ | inserts a correction entry (could also be a plain insert with policy; an RPC keeps the author rule in one place) |
| `complete_scheduled_activity(activity_id, body, occurred_at, entry_type)` | Op+ | writes linked log entry, advances `next_due_on`, sets `last_completed_at` |
| `resolve_deficiency(deficiency_id, note)` | Op+ | sets resolved fields, writes linked log entry |
| `delete_organisation(id, confirm_name)` | Ow | hard delete of the whole tenant (cascades) |

These exist because each of them must change rows that the caller can't change directly
(for example, an operator advancing a schedule that only admins may edit), or must
change several rows atomically.

### 5.6 Storage

One **private** bucket, `documents`, created by migration:

- `file_size_limit` 25 MB; `allowed_mime_types`: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`, DOCX, XLSX.
- Object path: `{organisation_id}/{uuid}/{sanitised-file-name}`. The first folder is always the organisation.
- Policies on `storage.objects` (bucket `documents` only):
  - select: `private.path_org_id(name) in (select private.org_ids('viewer'))`
  - insert: `… in (select private.org_ids('operator'))`
  - delete: admin+
  - update: none (no overwriting; every upload is a new object)
- `private.path_org_id(name)` returns the first path segment as a uuid, or `null` if it isn't one, so a malformed path is denied rather than raising an error.
- Files are viewed through **short-lived signed URLs** (e.g. 5 minutes) created per request. Nothing is public.

Upload flow for a photo on a log entry: the browser uploads straight to Storage as soon as
the photo is taken (so slow mobile uploads happen while the user is still typing). On
save, the server action calls one RPC that inserts the log entry and its `documents` rows
together. Uploads that were never attached to anything are removed by a periodic cleanup
(Phase 10).

**Site cover photo (D17, Phase 7):** optional `sites.cover_document_id` →
`documents (id)` of kind `photo` in the same organisation (composite FK). Not part of the
core workflow; a site without a photo shows a neutral placeholder.

## 6. Triggers

| Trigger | On | Purpose |
|---|---|---|
| `handle_new_user` | `auth.users` insert | create `profiles` row |
| `sync_profile_email` | `auth.users` update of email | keep `profiles.email` in sync |
| `set_updated_at` | every mutable table | maintain `updated_at` |
| `prevent_org_change` | every tenant table | forbid changing `organisation_id` |
| `protect_last_owner` | `organisation_members` | at least one owner always |
| `set_author_name` | `log_entries` insert | snapshot author name; reject future `occurred_at` |
| `log_entries_append_only` | `log_entries` update / delete | reject everything except (a) the FK action `created_by → null` when an account is deleted and (b) deletes inside `delete_organisation()`, which sets a transaction-local flag for its own organisation id |
| `corrections_target_original` | `log_entries` insert | a correction must point at an entry that is not itself a correction |
| `record_history` | every tenant table | write `activity_history` |

## 7. Migrations, local database, types, tests

### Environments (D1, D2)

| Environment | Database | How migrations get there |
|---|---|---|
| **Local** | Supabase CLI stack (`supabase start`) in any Docker-compatible runtime (Docker Desktop, Colima, Podman, …) | `supabase db reset` replays every migration + `seed.sql` |
| **Development** | The hosted project in `.env.local` | `supabase link` once, then `supabase db push` |
| Production | Separate project, created before launch (Phase 10) | `supabase db push` from CI or a release checklist |

The app in `npm run dev` talks to the **hosted development** project (its URL/key are in
`.env.local`). Local Supabase is used for migration development and the automated
database tests. To run the app against local Supabase instead, put the values printed by
`supabase status` into `.env.local`.

### Layout

```
supabase/
  config.toml                                 -- local stack config, committed
  migrations/
    <timestamp>_foundation.sql                -- Phase 1 (see §8)
    <timestamp>_organisations.sql             -- Phase 2: enums org_role, organisations, members, invitations, history, RPCs
    <timestamp>_sites_installations.sql       -- Phase 3
    <timestamp>_log_entries.sql               -- Phase 4
    <timestamp>_scheduled_activities.sql      -- Phase 5
    <timestamp>_deficiencies.sql              -- Phase 6
    <timestamp>_documents_storage.sql         -- Phase 7
  seed.sql                                    -- local demo data only; never run against hosted projects
  tests/
    000_setup.test.sql                        -- pgTAP + test helper availability
    010_foundation.test.sql                   -- Phase 1
    0x0_<area>.test.sql
```

Enums and tables are created in the phase that first needs them, not all up front.

- Migrations already applied anywhere outside a developer's machine are never edited; fixes are new migrations.
- TypeScript types are generated into `lib/supabase/database.types.ts` (`npm run db:types`) and committed. Regenerated after every migration.
- **Database tests (pgTAP, `npm run test:db` → `supabase test db`)**: each test file runs in a transaction that is rolled back. From Phase 2 on, a fixture with two organisations and one user per role in each; for every table assert:
  - each role can do exactly what §5.3 allows, and nothing else;
  - a member of organisation A reads zero rows from organisation B and cannot insert, update or delete there;
  - the `anon` role reads nothing.
  These tests are the definition of done for each database phase.

## 8. Implemented: Phase 1 foundation

Migration `supabase/migrations/20261001152559_foundation.sql` (applied locally only — see
README for pushing it to the hosted development project).

**Default privileges** (for objects created by `postgres` in future migrations):
- `anon`: nothing on tables, sequences or functions in `public`.
- `authenticated`: **no** table privileges by default — including TRUNCATE, REFERENCES,
  TRIGGER and MAINTAIN, which this Supabase version otherwise grants (TRUNCATE ignores RLS).
  Every migration must therefore `grant` exactly the table/column privileges a table needs.
- Functions: `PUBLIC` no longer gets `EXECUTE` automatically; each function is granted explicitly.

**`private` schema**: not in the Data API's exposed schemas (`supabase/config.toml`:
`public`, `graphql_public`). `authenticated` has `USAGE` so policies can call helpers that
are granted individually.

**Shared trigger functions**:
- `private.set_updated_at()` — maintains `updated_at`.
- `private.prevent_organisation_change()` — rejects changing `organisation_id` (used by every tenant table from Phase 2).

**`public.profiles`** — as in §4, with `email` nullable (because `auth.users.email` is) and
`phone` limited to 40 characters.
- RLS: a user can select and update only their own row (Phase 2 adds "profiles of people
  in my organisations").
- Privileges: `select` and `update (full_name, phone)` for `authenticated`; nothing for `anon`;
  no insert/delete for anyone through the API.
- Triggers on `auth.users`: `on_auth_user_created` → `private.handle_new_user()` creates the
  profile, taking `full_name` from sign-up metadata (trimmed, max 200, empty → null);
  `on_auth_user_email_changed` → `private.sync_profile_email()`.

**Tests**:
- `supabase/tests/000_security_baseline.test.sql` — schema-wide guards that every later
  phase inherits: RLS on every `public` table; no `anon` table privileges; no `anon`
  function execute in `public`/`private`; no TRUNCATE/REFERENCES/TRIGGER for
  `authenticated`; `search_path` set on every security definer function; new tables get no
  privileges by default.
- `supabase/tests/010_foundation.test.sql` — profile creation and email sync, own-row
  visibility, own-name update, column privilege on `email`, no insert/delete, length check,
  `anon` denied, both shared triggers, cascade on auth user deletion.

## 9. Implemented: Phase 2 organisations and tenant access

Migration `supabase/migrations/20261001155227_organisations.sql` (local only).

**Differences from the §4 sketch, decided during implementation**
- `organisation_members` has a surrogate `id` (unique `(organisation_id, user_id)`), so
  history rows and the UI can address a membership by one uuid.
- `organisations.slug` = slugified name (Estonian letters transliterated) + `-` + 6 random
  characters, generated by `create_organisation()` and **never changed** (no update grant).
  Slugs are **stable and non-sequential** URL identifiers. They are not a security
  mechanism: tenant security comes from RLS. The suffix only avoids collisions between
  organisations with similar names.
- No `organisations.archived_at` and no `delete_organisation()` yet — organisation deletion
  needs the Phase 4 append-only exception and is deferred.
- `organisation_invitations`: `token_hash` (sha256, 32 bytes) instead of a public id,
  `revoked_by` added, validity 7 days, email required. `invitation_preview()` requires a
  session (anonymous visitors are sent to login first).
- `activity_history.actor_id` has no foreign key, so history survives account deletion.

**Helper functions** (`private`, all `security definer`, `search_path = ''`)

| Function | Granted to | Purpose |
|---|---|---|
| `role_rank(org_role)` | — | owner 4 … viewer 1 |
| `org_ids(min_role)` | authenticated | organisation ids where the caller has at least `min_role`; used by every policy |
| `has_org_role(org, min_role)` | — | boolean form for use inside RPCs |
| `co_member_ids()` | authenticated | users sharing an organisation with the caller (profiles policy) |
| `protect_last_owner()` | trigger | blocks removing/demoting the last owner; locks the organisation row to serialise concurrent changes |
| `record_history()` | trigger | writes `activity_history`; strips `token_hash`; skips no-op updates |
| `slugify(text)`, `random_suffix(int)` | — | slug generation |
| `invitation_token_hash(text)` | — | `sha256(token)` |

**RPCs** (`public`, granted to `authenticated` only)

| RPC | Rule |
|---|---|
| `create_organisation(name, registry_code)` | any signed-in user; caller becomes owner; returns slug |
| `create_invitation(org, email, role)` | admin+; `owner` role only by an owner; refuses existing members; revokes the previous live invitation for that email; returns the plaintext token once |
| `revoke_invitation(id)` | admin+ of that organisation; owner invitations only by an owner; same `not_found` error for foreign and unknown ids |
| `invitation_preview(token)` | status only (`invalid` / `expired` / `used` / `revoked`) unless the invitation is live; then organisation name, role, expiry, whether the caller's email matches |
| `accept_invitation(token)` | locks the row; checks revoked → used → expired → confirmed email → email match → not already a member; inserts the membership with the stored role; marks accepted; returns slug |

**Policies**

| Table | select | insert | update | delete |
|---|---|---|---|---|
| organisations | member | RPC only | owner; columns `name`, `registry_code` only | — |
| organisation_members | member | RPC only | admin+ on non-owner rows, owner on owner rows; column `role` only; both old and new row checked | self (leave), admin+ non-owner rows, owner any; last owner protected |
| organisation_invitations | admin+, all columns **except `token_hash`** | RPC only | RPC only | — |
| activity_history | admin+ | trigger only | — | — |
| profiles | self and co-members | trigger only | self; `full_name`, `phone` | — |

History triggers: `organisations` (insert, update), `organisation_members` (insert, update,
delete), `organisation_invitations` (insert, update).

**Tests**: `supabase/tests/020_organisations.test.sql` (48), `030_invitations.test.sql` (41),
shared fixture `supabase/tests/helpers/fixture.psql` (two tenants × four roles, an
outsider, a user in both tenants). The baseline test now also pins the exact list of
functions `authenticated` can execute.

## 10. Implemented: Phase 3 sites and electrical installations

Migration `supabase/migrations/20261001161757_sites_installations.sql` (local only).

**Tables** (simplified from the §4 sketch to intentionally minimal master data)

| sites | |
|---|---|
| `name` | 1–200, trimmed |
| `address` | ≤ 300 |
| `description` | ≤ 5000 |
| `responsible_person` | free text ≤ 200 (**review**) |
| `archived_at` | archive instead of delete |
| `created_by` | `default auth.uid()`, not client-writable |

`unique (id, organisation_id)` is the target of the installations' composite FK.

| electrical_installations | |
|---|---|
| `site_id` | composite FK `(site_id, organisation_id)` → `sites (id, organisation_id)` |
| `name` | 1–200 |
| `identifier` | tähis, ≤ 50, optional; **unique within its site** when present (case-insensitive, archived included) — migration `20261001172308_installation_identifier_per_site.sql` |
| `installation_type` | enum `building`, `switchboard`, `substation`, `solar`, `storage`, `charging`, `industrial`, `other` (**review**) |
| `location` | where on the site, ≤ 200 |
| `description`, `notes` | ≤ 5000 each |
| `commissioned_on` | date, 1900–2100 in the database; "not in the future" in the app |
| `status` | enum `in_service`, `out_of_service` (**review**) |
| `responsible_person` | free text ≤ 200 (**review**: is this the käidukorraldaja?) |
| `archived_at`, `created_by` | as on sites |

Removed from the sketch on purpose: voltage level, main fuse, connection point code,
supervisor user link. They are regulatory/technical classifications that need the domain
review before they are added.

**Rules enforced in the database**
- RLS: members read; **owner/admin** insert and update (incl. archive/restore); operators
  and viewers read only. No delete policy or grant — archive instead.
- Column grants: `id`, `organisation_id` (after insert), `created_by` and timestamps are not
  client-writable.
- An installation's site must be in the same organisation (composite FK).
- `private.ensure_site_active()`: no new installation on, and no move onto, an archived site
  (`site_archived`). Archiving a site keeps its installations; restoring an installation
  under an archived site is allowed.
- `prevent_organisation_change`, `set_updated_at`, `record_history` on both tables.

**Tests**: `supabase/tests/040_sites_installations.test.sql` (54): isolation by id, by
organisation filter and through joins; forged organisation, site and creator ids;
cross-organisation FK on insert and move; full role matrix; archived sites; invalid ids;
history; and a Storage guard (no objects readable or writable before Phase 7).
