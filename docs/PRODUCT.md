# KAIDLY — Product

> **Elektripaigaldise käit. Lihtsalt.**

KAIDLY is a digital operations logbook for electrical installations. It replaces the
paper *käidupäevik*, the Excel *käidukava* and the folder of protocols that every
electrical operation supervisor (*käidukorraldaja*) keeps today.

Status: approved 2026-10-01; Phases 1–8 implemented, plus ET/EN/RU, change history and mobile workflow improvements (see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)).

---

## 1. Who it is for

| User | What they need from KAIDLY |
|---|---|
| Electrical operation supervisor (*käidukorraldaja*) | Log what was done, see what is due, track deficiencies, prove it later. Often responsible for many installations across several clients. |
| Electrical contractor | Run operation supervision as a service for many customers; each customer is a separate organisation. |
| Facility manager | See the state of the building's installations, what is overdue, what is open. |
| Industrial company | Keep operating records for own substations, switchboards and production lines. |
| Commercial property owner | Oversight across a portfolio of buildings without becoming an electrician. |
| Renewable energy operator | Operating log for solar parks, storage and grid connections. |

The primary daily user is a **technician on site, on a phone, possibly with gloves,
in a basement with poor signal**. Everything else is secondary to that person.

## 2. What KAIDLY is not

KAIDLY is deliberately narrow. It is **not**:

- an EAM or a generic CMMS (no spare parts, work orders, cost centres, asset hierarchies deeper than three levels)
- an ERP (no invoicing, timesheets, procurement)
- an AI product (no assistants, summaries, predictions)
- an IoT platform (no sensors, telemetry, SCADA)
- a project management tool (no tasks boards, Gantt charts, chat)

When a feature request pulls in one of these directions, the answer is no by default.

## 3. Core model

```
Organisation          e.g. "Kinnisvara OÜ" — the tenant; owns all data
└── Site              e.g. "Tartu mnt 10, Tallinn" — a physical location
    └── Electrical installation   e.g. "Peajaotuskilp PJK-1", "Päikesepark 1 MW"
        ├── Operating log entries     (käidupäevik)
        ├── Scheduled activities      (käidukava)
        ├── Deficiencies              (puudused)
        └── Documents                 (dokumendid)
```

Users belong to one or more organisations, with one role per organisation:

| Role | Estonian | Can |
|---|---|---|
| Owner | Omanik | Full control: organisation settings, ownership, all membership management, sites and installations, everything an admin can do. (Deleting an organisation is not built yet.) |
| Admin | Administraator | Manage sites and installations and the käidukava, all operational data, organisation- and site-level documents (rename, recategorise, archive), invite and manage members — except anything touching ownership (granting/removing owner, organisation settings). |
| Operator | Käitaja | Write and correct log entries, complete scheduled activities, record deficiencies, move them to in progress and resolve them. **Cannot** create, edit or archive sites, installations or planned activities, and cannot manage members. Upload documents and photos for installations, log entries and deficiencies. |
| Viewer | Vaataja | Read only. For property owners, auditors, management. |

Nobody — not even an owner — can change or delete an operating-log entry, delete a
deficiency, or replace or delete a file attached to either. The exact matrix is in DATABASE.md §5.

A contractor serving ten customers is a member of ten organisations. Switching
organisation is one tap.

## 4. MVP scope

1. **Dashboard** — what needs attention: overdue and due-soon activities, open high/critical deficiencies, latest log entries, sites with outstanding items; a first-use checklist (site → installation → first entry) until the organisation is set up.
2. **Organisations** — create, rename, switch between, manage members.
3. **Sites** — list, create, edit, archive.
4. **Electrical installations** — list per site, create, edit, archive; one page that shows everything about the installation.
5. **Operating log / Käidupäevik** — chronological, strictly append-only record of what happened at an installation. Mistakes are fixed with linked correction entries; the original always stays visible.
6. **Scheduled activities / Käidukava** — recurring and one-off activities (*tegevused*) with due dates and priority; "Märgi tehtuks" writes the log entry. Shown as *Tulemas* (upcoming), *Varsti* (due within 14 days), *Üle tähtaja* (overdue) or *Tehtud* (completed) — derived from dates, there is no "in progress" state. Recurring due dates stay anchored to the plan.
7. **Deficiencies / Puudused** — found problems with severity (*Madal*, *Keskmine*, *Kõrge*, *Kriitiline*), due date and status *Avatud* (open), *Töös* (in progress) or *Lahendatud* (resolved). Resolving requires a note and writes the log entry; resolved deficiencies stay in history and are never deleted.
8. **Documents** — schemes, protocols and manuals for the organisation, a site, an installation, a log entry or a deficiency (PDF, DOCX, XLSX; up to 25 MB). **Photos are not stored in KAIDLY** (2026-10-08): log entries and deficiencies keep an optional *Fotode link* to the folder or album where the photos are (any https provider). Images uploaded earlier stay visible and can be deleted; the record keeps a trace. Files on log entries and deficiencies are part of the record and never change; a log entry's author can add files for 24 hours, later evidence goes on a correction. General documents can be archived and restored, never deleted. Anyone who may read a document may also open and download it. HEIC is not supported in the MVP (phone photos are converted to JPEG). *(Site cover photo: not built.)*
9. **Users and permissions** — invite with a copyable, single-use link; four roles; remove members.
10. **Change history** — owners and admins read who changed what and when (sites,
    installations, operating plan, deficiencies, documents, members, invitations), in plain
    sentences. Operating log entries are their own history.
11. **Languages** — Estonian (default), English and Russian. Visitors choose in the header
    (remembered in a cookie); signed-in users' choice is saved to their profile and follows
    them to other devices. URLs never change with the language.
12. **Getting started** — a six-step checklist derived from real data, guided empty
    states in every module, and Abi with the core terms.
13. **Organisation lifecycle** — owners can permanently delete an organisation without
    operational history; one with history can only be deactivated (read-only, data kept,
    restorable) until retention and privacy-erasure rules are decided. User accounts are
    never deleted with an organisation.

### Out of MVP (explicitly)

Offline mode with sync, native apps, PDF report generation, e-signatures, QR stickers,
email sending of any kind (invitations, reminders), push notifications, public API,
integrations (EAM, ERP, IoT), AI features, payments/billing, 
Several of these are good ideas for after MVP (see §7) — they are listed so nobody
builds them early.

## 5. The workflow that matters most

> Open site → select installation → add operating log entry → optionally add a photo link / document → save

Targets for this flow on a mid-range phone:

- **≤ 3 taps** from opening the app to an empty log entry form for a recently used installation.
- **≤ 30 seconds** to record a routine entry with a photo link.
- Works one-handed; all primary actions reachable by thumb.
- Typed text is never lost — if the save fails, the draft stays on the device.

Status (Phases 4–8): "Lisa sissekanne" on the overview opens a picker with the user's
recently used installations first (straight to the form when there is only one); the form
takes the type with one tap, an optional photo link (2026-10-08: photos are no longer
uploaded), and keeps everything typed after validation errors. If a file upload fails, the
entry is already saved and the file can be retried. Not yet: device-side drafts when the network
fails before saving (Phase 9).

See [DESIGN.md §6](DESIGN.md#6-mobile-ux) for how.

## 6. Principles

- **Simple beats complete.** One way to do each thing. Few fields; the optional ones collapsed.
- **The log is a record.** Entries are not silently edited or deleted. Corrections are visible.
- **Tenant isolation is non-negotiable.** Enforced in the database, not the UI.
- **Estonian first.** UI in Estonian; terms as a *käidukorraldaja* uses them.
- **Calm, precise interface.** The app is a tool, not a showcase.

## 6a. Accounts, company details and KAIDLY administration (2026-10-02)

- **Konto:** name, phone, email change (confirmed through Supabase Auth; the account stays
  the same), password change with the current password, forgotten-password link, language,
  sign out here or on all other devices. KAIDLY never stores passwords.
- **Ettevõte** (EN *Organisation*, RU *Организация*): owners and admins edit name, registry
  code, contact email, phone, address and notes; operators and viewers read them. The
  company name is display data; the link address (slug) never changes.
- **KAIDLY Admin** (platform administration, for the KAIDLY team only): overview of real
  counts ("Mis toimub KAIDLYs?"), user and company directories with support metadata,
  platform-wide deadlines, system facts and launch blockers, an audit log of every admin
  change. Admins can change or remove memberships, disable/re-enable accounts, revoke
  sign-ins and send a password-reset email. They **cannot** see passwords, sign in as a
  user, or read customer documents and log contents, and they are not members of customer
  companies.

## 6b. Deadline countdowns and reminders (2026-10-02)

- Every active activity shows a countdown ("84 päeva jäänud", "Tähtaeg täna",
  "3 päeva üle tähtaja") on the dashboard, in Käidukava and on activity pages — derived,
  never stored. Urgency is restrained: colour only in the last week, today and overdue.
- Owners and admins choose **when to be reminded** per activity: 30 / 14 / 7 / 1 days
  before and one custom value (0–365; 0 = on the due date). Default: 14 days.
- Reminders go to the company's owners, admins and operators (not viewers) as **in-app
  notifications**: a bell with the unread count, a notification centre (unread first, mark
  read, mark all read, older pages) and a short toast for a new reminder. "Vaata tegevust"
  opens the exact activity.
- A daily background run creates reminders even if nobody opens KAIDLY; each reminder is
  created once. Completing a recurring activity moves the countdown to the next occurrence
  and turns the old reminders into history.
- Not yet: email, push, weekly digest; a responsible KAIDLY member per activity (the
  responsible person is free text and never guessed).

## 6c. Trial and manual activation (2026-10-02)

- Every new company gets **14 days of full access** (exactly 14 × 24 h from creation).
- Afterwards the company is **read-only**: everything stays visible (log, plan, deficiencies,
  documents, history, notifications), nothing can be added or changed. User accounts are
  never affected; a person can have one company active and another read-only.
- KAIDLY activates full access **manually** (after an invoice is paid outside the app) for
  1/3/6/12 months, until a date, or indefinitely; it can extend trials and end access. Every
  change is in the admin log. No online payment, invoicing or pricing plans yet.
- 90 days after expiry a company is flagged for a support decision; nothing is deleted
  automatically.

## 6d. Search and reports (2026-10-02)

- **Otsing** (Ctrl/Cmd+K): companies, sites, installations (name or identifier), log entries,
  activities, deficiencies and documents across all the user's companies, grouped, each a
  direct link. Only what the user may already open.
- **Aruanded** per company: operating log (with corrections shown as corrections), operating
  plan (countdown, last done, reminders), deficiencies, document register, site summary and
  installation summary. Shared filters, an on-screen preview, then **PDF** (A4, KAIDLY
  header/footer, page numbers) or **CSV** (tables). Read-only (expired) companies can still
  export their data.
- Not yet: scheduled or e-mailed reports, saved report settings, attachments in exports
  (zip), more than 5000 rows per export.

## 7. Likely after MVP (not committed)

**Required before or at launch (decided 2026-10-02):**
- **Public pricing page (Hinnad / Pricing).** Simple, publicly visible prices for normal plans
  — no "contact sales" — positioned as high value and aggressively affordable compared with
  electrical/compliance software, especially for small electrical contractors and
  independent *käidukorraldajad*. Prices and plan/storage/feature limits are **not decided**
  and will come from separate Estonia/EU competitor research. No billing exists yet.
- **Storage quotas and upload rate limits** — a production launch blocker.
- **Privacy erasure** — a dedicated, audited admin workflow for legitimate personal-data
  deletion. No automatic deletion and no hardcoded retention periods: retention is a
  legal/domain decision still to be made.

Ideas:

- Installation QR codes (sticker on the switchboard opens its log)
- Offline entry queue for sites without signal
- PDF export of the operating log and *käidukava* for audits
- Email reminders for overdue activities
- Email, push and weekly digest delivery of reminders (in-app reminders exist)

## 8. Terminology

The UI speaks the vocabulary of electrical operations in Estonian. One term per concept,
used the same way everywhere (strings live in `lib/i18n/et.ts`).

Main terms in all three languages (RU = **pending native electrical-professional review**):

| et | en | ru |
|---|---|---|
| Käidupäevik | Operating log | Оперативный журнал |
| Käidukava | Operating plan | План эксплуатации |
| Puudused | Deficiencies | Дефекты |
| Dokumendid | Documents | Документы |
| Objekt | Site | Объект |
| Elektripaigaldis | Electrical installation | Электроустановка |
| Sissekanne | Entry | Запись |
| Tegevus | Activity | Мероприятие |
| Parandus | Correction | Исправление |
| Omanik · Administraator · Käitaja · Vaataja | Owner · Administrator · Operator · Viewer | Владелец · Администратор · Оператор · Наблюдатель |

Never translated: identifiers, uploaded filenames, user-entered text, company and site names.

Estonian term rules:

| Concept | UI term (et) | Not | Notes |
|---|---|---|---|
| Tenant | Ettevõte (EN organisation, RU организация) | organisatsioon, firma | Changed 2026-10-02 to the owner's wording. |
| Physical location | Objekt | asukoht, hoone | Plural *objektid*. |
| Installation | Elektripaigaldis / paigaldis | seade, vara | *Paigaldis* in lists and buttons. |
| Installation identifier | Tähis | kood, ID | e.g. *PJK-1*; unique per site. |
| Operating log | Käidupäevik | logi, ajalugu | |
| Log entry | Sissekanne | kirje, logikanne | Primary action **Lisa sissekanne**. |
| Correction | Parandus | muudatus | Always with *Paranduse põhjus*. |
| When it happened / who did it | Toimumise aeg / Teostaja | | *Kirja pannud* = who recorded it. |
| Operating plan | Käidukava | kalender, graafik | |
| Planned activity | Tegevus | ülesanne | Only inside Käidukava. |
| Due states | Üle tähtaja · Varsti · Tulemas · Tehtud | hilinenud, ootel | Derived from dates. |
| Complete an activity | Märgi tehtuks | lõpeta | Writes a log entry. |
| Deficiency | Puudus | viga, probleem, rike* | *Rike* is a log entry type (fault). |
| Severity | Raskusaste: Madal · Keskmine · Kõrge · Kriitiline | prioriteet | Descriptive, not a legal class. |
| Deficiency states | Avatud · Töös · Lahendatud | suletud | *Lahenda puudus* writes a log entry. |
| Documents | Dokumendid | failid | |
| Document categories | Audit · Mõõteprotokoll · Ühejooneskeem · Käidukava · Hooldusraport · Deklaratsioon · Juhend · Foto · Muu | | *Käidukava* as a category = the plan document (PDF), not the module. *Foto* only for images uploaded before photo links. |
| Attachments on a record | Fotod ja failid / manused | lisad | Section title *Fotod ja failid*. |
| Photo link | Fotode link | fotolink, piltide link | *Ava link*; hint *Lisa link kaustale või albumile, kus fotod asuvad.* |
| Delete an earlier image | Kustuta pilt | eemalda foto | Trace: *Pilt kustutatud — nimi, aeg*. |
| Upload | Laadi üles | lisa fail, upload | Progress *Laadin üles… 40%*. |
| Archive | Arhiveeri / Taasta | kustuta | Nothing operational is deleted. |
| Roles | Omanik · Administraator · Käitaja · Vaataja | | |
| Overview | Ülevaade | dashboard, töölaud | Section *Mis vajab tähelepanu*. |

## 8a. Glossary

| Estonian | English | Notes |
|---|---|---|
| Elektripaigaldis | Electrical installation | |
| Käit | Operation | Operating an installation safely. |
| Käidukorraldaja | Operation supervisor | Person responsible for operation of an installation. |
| Käidupäevik | Operating log | Chronological record of operations. |
| Käidukava | Operating schedule / plan | Planned recurring operating activities. |
| Puudus | Deficiency | Found non-conformity or defect. |
| Objekt | Site | Physical location. |
| Sissekanne | Entry | A log entry. Primary action: **"Lisa sissekanne"**. |
| Parandus | Correction | A log entry that corrects an earlier one. |
| Tegevus | Activity | A scheduled activity inside the käidukava. |
| Ülevaatus | Inspection | |
| Lülitamine | Switching operation | |
| Mõõtmine | Measurement | e.g. insulation resistance. |
| Hooldus | Maintenance | |
| Rike | Fault | |

**Terminology rule:** the UI uses electrical-operations vocabulary — **Käidupäevik,
Käidukava, Puudused, Dokumendid** as primary navigation — rather than the generic wording
on the brand board. "Tegevused" is used only inside Käidukava. Internal change history
exists but is not a primary navigation item.

> **Domain review needed:** installation fields, entry types and severity levels must be
> reviewed by a practising electrical operations professional before Phase 3 is
> considered final. KAIDLY must not claim regulatory compliance without that review.
>
> Open questions after Phase 3 (all marked "DOMAIN REVIEW PENDING" in the migration):
> 1. Installation types — is the list right, and is "type" the right concept at all?
> 2. Status — are *kasutuses* / *kasutusest väljas* enough (e.g. *ajutiselt välja lülitatud*, *rekonstrueerimisel*)?
> 3. "Responsible person" on sites and installations — should this be the *käidukorraldaja*, and should it link to a KAIDLY user?
> 4. Which technical fields are needed for daily operation and audits (voltage level, main fuse, connection point/EIC code, *tehnilise kontrolli* dates) — deliberately not added yet.
> 5. ~~Is the identifier (*tähis*) unique per site or per organisation?~~ Decided 2026-10-01: optional, unique within a site.
