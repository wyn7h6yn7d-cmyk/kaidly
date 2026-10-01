# KAIDLY — Product

> **Elektripaigaldise käit. Lihtsalt.**

KAIDLY is a digital operations logbook for electrical installations. It replaces the
paper *käidupäevik*, the Excel *käidukava* and the folder of protocols that every
electrical operation supervisor (*käidukorraldaja*) keeps today.

Status: approved 2026-10-01; Phases 1–8 implemented (see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)), including documents and the dashboard.

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
8. **Documents** — schemes, protocols, manuals and photos for the organisation, a site, an installation, a log entry or a deficiency (PDF, JPG, PNG, WebP, DOCX, XLSX; up to 25 MB). Files on log entries and deficiencies are part of the record and never change; general documents can be archived, never deleted. *(Site cover photo: not built.)*
9. **Users and permissions** — invite with a copyable, single-use link; four roles; remove members.

### Out of MVP (explicitly)

Offline mode with sync, native apps, PDF report generation, e-signatures, QR stickers,
email sending of any kind (invitations, reminders), push notifications, public API,
integrations (EAM, ERP, IoT), AI features, payments/billing, multi-language UI.
Several of these are good ideas for after MVP (see §7) — they are listed so nobody
builds them early.

## 5. The workflow that matters most

> Open site → select installation → add operating log entry → optionally add photo/document → save

Targets for this flow on a mid-range phone:

- **≤ 3 taps** from opening the app to an empty log entry form for a recently used installation.
- **≤ 30 seconds** to record a routine entry with one photo.
- Works one-handed; all primary actions reachable by thumb.
- Typed text is never lost — if the save fails, the draft stays on the device.

Status (Phases 4–8): "Lisa sissekanne" on the overview opens a picker with the user's
recently used installations first (straight to the form when there is only one); the form
takes the type with one tap, photos straight from the camera (resized on the phone), and
keeps everything typed after validation errors. If a photo upload fails, the entry is
already saved and the photo can be retried. Not yet: device-side drafts when the network
fails before saving (Phase 9).

See [DESIGN.md §6](DESIGN.md#6-mobile-ux) for how.

## 6. Principles

- **Simple beats complete.** One way to do each thing. Few fields; the optional ones collapsed.
- **The log is a record.** Entries are not silently edited or deleted. Corrections are visible.
- **Tenant isolation is non-negotiable.** Enforced in the database, not the UI.
- **Estonian first.** UI in Estonian; terms as a *käidukorraldaja* uses them.
- **Calm, precise interface.** The app is a tool, not a showcase.

## 7. Likely after MVP (not committed)

- Installation QR codes (sticker on the switchboard opens its log)
- Offline entry queue for sites without signal
- PDF export of the operating log and *käidukava* for audits
- Email reminders for overdue activities
- English UI

## 8. Terminology

The UI speaks the vocabulary of electrical operations in Estonian. One term per concept,
used the same way everywhere (strings live in `lib/i18n/et.ts`).

| Concept | UI term (et) | Not | Notes |
|---|---|---|---|
| Tenant | Organisatsioon | firma, ettevõte | |
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
| Document categories | Audit · Mõõteprotokoll · Ühejooneskeem · Käidukava · Hooldusraport · Deklaratsioon · Juhend · Foto · Muu | | *Käidukava* as a category = the plan document (PDF), not the module. |
| Attachments on a record | Fotod / manused | lisad | Section title *Fotod*. |
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
