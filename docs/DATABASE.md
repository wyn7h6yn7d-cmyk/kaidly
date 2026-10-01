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
`phone` ≤ 40. Readable by the user and co-members; the user may update `full_name` and
`phone` only.

### organisations
`name` 1–200, `slug` (unique; slugified name + 6 random characters; never changed),
`registry_code` ≤ 30, `created_by`. Slugs are **stable, non-sequential URL identifiers** —
not a security mechanism; access is enforced by RLS. Created only by `create_organisation()`.

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
| organisation | V+ | anyone signed in (`create_organisation`) | Ow: name, registry code | — |
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
| `finalize_document(document)` | the uploader, Op+ | §10: `ready` if the object exists at the registered path with the registered size and type, else `failed` |

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
- New files go onto a log entry only from its author within **one hour** of recording it
  (`log_entry_attachment_closed`) — enough to finish uploads from site. Later material goes
  on a **correction** entry (corrections are new log entries); the original's files stay.
- Deficiencies accept files until resolved (`deficiency_resolved`); then they are final.
- Completed activities: files go on the completion's log entry (no separate link).
- General documents (organisation, site, installation) can be renamed, recategorised and
  **archived/restored** by admins; never deleted. Archived documents stay readable.
- Ready rows can't be deleted even by the table owner (trigger), and TRUNCATE is refused.

Errors never reveal another organisation's objects: foreign and unknown documents both
give 404 / `not_found`.

## 10a. Dashboard view (Phase 8)

`public.site_attention` (`security_invoker`): one row per **active** site with
`overdue_activities`, `due_soon_activities` (today … today + 14, Tallinn), `open_deficiencies`
and `serious_deficiencies` (high/critical, not resolved). Because it runs with the caller's
rights, every count comes through RLS — a member of two organisations sees each
organisation's own numbers. `select` for `authenticated` only. Partial indexes
`scheduled_activities_site_due_idx` and `deficiencies_site_open_idx` back the counts.
The dashboard's other sections are bounded queries (`limit 5` + exact count) on the tables.

## 11. Tests

`npm run test:db` runs pgTAP: 368 tests in 10 files, using the shared fixture
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
| `080_documents` | 43 | metadata isolation, roles (viewer can't upload, operator scope, admin-only general documents), forged/foreign paths and parents, SVG/size/filename rules, attachment windows, storage read/upload/overwrite/delete across tenants, pending objects unreadable, finalize (missing object, size mismatch, foreign caller), historical files immutable and undeletable, archive/restore, anon reads nothing |
| `090_dashboard` | 12 | `site_attention` counts, isolation per role, member of two organisations, outsider and anon, archived sites, `security_invoker` |

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
