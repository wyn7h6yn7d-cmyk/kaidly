# KAIDLY — Design

Status: implemented for Phases 1–6 (tokens, fonts, primitives, provisional logo, app shell, all product screens). Public landing page implemented (§5a); real photography still to be licensed (D11).

Source: [`design/KAIDLY-brand-board.png`](../design/KAIDLY-brand-board.png) plus the written
brief. Where the two differ, this document records which one wins and why.

---

## 0. What the brand board establishes

- **Logo**: a slanted green lightning-bolt mark + heavy geometric wordmark `KAIDLY`.
  Variants: dark on light, light on dark (black tile), black mono. App icon: volt bolt on a
  deep-green rounded square (`app/icon.svg`, plus `favicon.ico` 16/32/48 and
  `apple-icon.png` 180, generated from it) — bold enough for 16 px and visible on light and
  dark browser chrome. Descriptor line: *ELECTRICAL OPERATIONS. SIMPLIFIED.* /
  *Digitaalne käiduraamat elektripaigaldistele*.
- **Brand messages**: "Elektripaigaldise käit. Lihtsalt." · "Ohutumad paigaldised. Vähem Excelit." ·
  "Ohutumad paigaldised, targem haldus, parem homme."
- **Palette**: six colours (§2).
- **Type**: Inter and Manrope (§3).
- **Handwritten notes**: short all-caps marker-style phrases in the margins
  ("KORRASTUS LOOB TURVALISUST", "DETAILID LOEVAD", "INIMESED, KES HOIAVAD EESTI TÖÖS"),
  often with a hand-drawn arrow or underline, sometimes on a torn paper strip.
- **Materials**: raw concrete, torn paper, a warm paper ground; real photos of switchgear,
  substations, data halls, solar fields and a technician in a hard hat.
- **Icons**: thin outline icons with rounded ends — lucide matches this style.
- **App mock-ups**: deep green sidebar on desktop, KPI row, "Tulevased tegevused" list with
  coloured due dots, site card with photo, "Viimased tegevused" with a "Tehtud" status;
  on mobile an installation page (`PK-01`) with tabs, "Järgmine tegevus" and a full-width
  green **"+ Lisa sissekanne"** button above a bottom tab bar.

### Where we deliberately differ from the mock-ups

| Board shows | We do | Why |
|---|---|---|
| White cards with soft shadows on a grey ground | Same layout, but flat: hairline borders, no or minimal shadow | Brief: avoid floating cards and excess shadow |
| Rounded corners ~8–12 px | 4–6 px | Brief: avoid excessive rounding; keeps it precise |
| Nav items "Hooldus", "Aruanded" | Not in the MVP | Out of scope (PRODUCT.md §4) |
| Site cards / rows with a cover photo | Optional cover photo, Phase 7 (D17) | Needs Storage; not part of the core workflow |
| Activity tabs "Tulevased · Tegemisel · Lõpetatud" | Derived states **Üle tähtaja · Varsti · Tulemas · Tehtud** | Scheduled activities have no stored "in progress" state (D18) |
| Generic labels "Tegevused", "Auditijälg" in the main nav | **Käidupäevik · Käidukava · Puudused · Dokumendid**; "Tegevused" only inside Käidukava; change history is not a nav item | Domain terminology (D20) |

---

## 1. Character

KAIDLY should feel like a well-made instrument panel and a good paper logbook, not a
startup website.

| Is | Is not |
|---|---|
| industrial, precise | glossy, futuristic |
| trustworthy, calm | loud, "growth" |
| Scandinavian / Baltic: plain, warm, honest materials | sterile, corporate-blue |
| human — the occasional handwritten mark | cute, illustrated |
| practical — every element earns its place | decorative |

### Never

- gradients as decoration, glowing blobs, mesh backgrounds
- glassmorphism / frosted panels
- floating card grids as the default layout
- stock startup illustrations, 3D shapes, AI-style sparkles
- large border radii (> 6 px), pill-everything
- heavy or coloured drop shadows
- emoji in UI

## 2. Colour

Brand palette from the board:

| Board name | Hex | Token | Role |
|---|---|---|---|
| Primaarne — sügav roheline | `#0F3D32` | `--k-green` | Sidebar, brand surfaces, links on light backgrounds, marketing blocks |
| Aktsent — energia ja liikumine | `#22D07A` | `--k-volt` | Primary button fill, active-item marker, focus ring **on dark surfaces only**, logo bolt, key marks |
| Tume — tekstid ja taustad | `#111827` | `--k-ink` | Body text, headings, dark tiles |
| Teisene — graafika ja jooned | `#6B7280` | `--k-grey` | Icons, lines; secondary text **on white only** |
| Taust — paberi toonalus | `#E7E5E1` | `--k-paper` | Page background |
| Soe tugi — tasakaal | `#D4C9BC` | `--k-sand` | Warm accents: marketing strips, paper notes, subtle highlights |

Derived functional tokens (not on the board; needed for a working UI):

| Token | Value | Role |
|---|---|---|
| `--k-surface` | `#FFFFFF` | Panels, inputs, list backgrounds (as in the board's app mock-ups) |
| `--k-line` | `#D6D3CD` | Hairline borders on paper and white |
| `--k-muted` | `#4B5563` | Secondary text on paper (6.0 : 1) — `#6B7280` fails there (3.8 : 1) |
| `--k-green-hover` | `#155446` | Hover/pressed on deep green |
| `--k-volt-hover` | `#1DB86B` | Hover/pressed on the accent button |
| `--k-warn` | `#B45309` | Due soon (amber; matches the board's orange dots) |
| `--k-danger` | `#B91C1C` | Overdue, critical deficiency (the board's red dots) |

Contrast, measured (WCAG AA needs 4.5 : 1 for text):

| Pair | Ratio | Use |
|---|---|---|
| ink on paper | 14.1 | ✅ body text |
| ink on volt | 8.8 | ✅ **primary button text** — dark text on green, as on the board |
| deep green on volt / volt on deep green | 6.0 | ✅ |
| white on deep green | 12.1 | ✅ sidebar text |
| grey `#6B7280` on white | 4.8 | ✅ secondary text on white panels |
| grey `#6B7280` on paper | 3.8 | ❌ text — use `--k-muted` on paper |
| volt on white / on paper | 2.0 / 1.6 | ❌ never use volt for text or thin icons on light backgrounds |

Rules:
- The accent green is a **fill**, never text on a light background. On light backgrounds
  links and active text use deep green.
- **Focus ring**: deep green on light surfaces (volt is only 2 : 1 there and fails the 3 : 1
  rule for UI parts); volt on deep green surfaces (`.focus-on-dark` utility).
- Status is never colour-only: always colour + word or icon ("3 päeva üle tähtaja").
- All text meets WCAG AA (4.5 : 1); large text and UI parts 3 : 1.
- Light theme only in the MVP. The starter's dark mode toggle (`next-themes`) is removed —
  one theme done well. (Field use in bright daylight favours a light UI.)

These map onto the existing shadcn CSS variables (`--background`, `--foreground`,
`--primary`, `--border`, `--ring` …) in `app/globals.css`, so primitives pick them up.

## 3. Typography

From the board: **Inter** and **Manrope**, both on Google Fonts, both with full Estonian
coverage (õ ä ö ü š ž), loaded via `next/font/google` (self-hosted at build, no runtime
requests to Google).

| Use | Face | Notes |
|---|---|---|
| Headings, KPI numbers, marketing display | **Manrope** 700–800 | Matches the heavy, geometric headline "Elektripaigaldise käit. Lihtsalt." |
| UI and body text | **Inter** 400 / 500 / 600 | |
| Codes, timestamps, measurements | Inter with `tabular-nums` | No third family; keeps `PJK-1`, `0,5 MΩ`, `12.03.2026 14:05` aligned |
| Handwritten notes | an all-caps marker face — candidates **Permanent Marker**, **Caveat Brush**, **Gochi Hand**; pick the closest to the board | **Marketing and auth screens only**, short phrases, never in working app UI |
| Logo wordmark | Production: **SVG only**. Now: provisional typeset wordmark in Manrope 800 + simple SVG bolt (`components/brand/logo.tsx`, `app/icon.svg`), clearly marked provisional (D19) | Replace when real assets exist |

- Strong black headings, tight but not cramped tracking; sentence case (Estonian style).
- Body 16 px minimum on mobile (prevents iOS zoom on inputs); 15 px allowed in dense desktop tables.
- Numbers tabular (`font-variant-numeric: tabular-nums`) in lists and tables.
- Dates, times and numbers via `Intl` per language (`t.fmt`): et `12.03.2026 14:05`,
  en `12/03/2026 14:05`, ru `12.03.2026 14:05`; decimal comma in et/ru. Always Tallinn time.
- Cyrillic: Inter, Manrope and Caveat are loaded with the `cyrillic` subset.
- **Fluid scale** (`tailwind.config.ts`): `display-1` clamp(33–70 px) for the hero and final
  CTA, `display-2` (34–64 px) section titles, `display-3` (25–38 px) editorial questions,
  `lead` (18–22 px). App headings stay practical (28/32 px page title). Body text never
  below 15 px; technical labels (12 px uppercase) only for eyebrows and drawing marks.

## 4. Shape, space, texture

- Radius: 4 px on inputs and buttons, 6 px on panels, 0 on tables. (`--radius: 0.375rem`.)
- Borders over shadows. A single 1 px hairline separates things; shadows only for menus
  and dialogs, and then subtle and neutral.
- 4 px spacing grid. Generous vertical rhythm on marketing; compact, scannable in the app.
- **Asymmetry** on marketing pages: offset headline columns, an image bleeding to one edge,
  a margin note in the handwritten face. In the app: a strong left-aligned page title with
  the primary action, not centred hero layouts.
- **Paper texture**: a very subtle grain on `--k-paper` backgrounds on marketing pages
  and the auth screens (one small tiling image or an SVG `feTurbulence` filter, < 5 % opacity).
  Torn-paper strips and concrete photography for marketing only, as on the board.
  Not inside the app's working screens, where it would hurt legibility.

## 5. Marketing vs application

| | Marketing (`/`, later pages) | Application (`/o/...`) |
|---|---|---|
| Purpose | Explain and earn trust | Get work done |
| Imagery | **Real photography**: switchboards, substations, solar fields, technicians at work, Baltic light. No stock illustrations. Needs sourcing (D11). | None, except user photos in the log |
| Brand expression | Full: deep green blocks, volt accents, handwritten notes, grain | Restrained: deep green sidebar (desktop), volt for the primary button, the active-item marker and focus on dark surfaces |
| Layout | Editorial, asymmetric | Lists and forms; tables on desktop, rows on mobile |
| Density | Airy | Compact but touch-safe |

### App UI building blocks

- **Page header**: title, short context line (site · installation), one primary action at right (desktop) or bottom (mobile).
- **List row** rather than card: one line of key info + one line of secondary info + status at right. Tap target is the whole row.
- **Status mark**: small square + word, never colour alone.
  Scheduled activities (derived from dates): `Üle tähtaja · 3 päeva` (danger),
  `Varsti · 5 päeva pärast` (warn), `Tulemas` (neutral), `Tehtud` (green) — calm, no alarm UI.
  Deficiencies: severity `Madal` / `Keskmine` / `Kõrge` / **`Kriitiline`** (bold) and a status
  badge `Avatud` / `Töös` / `Lahendatud`; "Tähtaeg ületatud" in text when overdue.
- **Corrected log entry**: the list shows the current text with a "Parandatud {date} · {name}"
  mark; the entry page shows the current values and a history list — newest correction
  marked "Kehtiv", each correction with its reason, the original muted but fully legible.
  There is never an "Edit" action, only "Paranda sissekanne".
- **Empty states**: one sentence telling what to do next and the button to do it. No illustrations.
- **Forms**: labels above fields, one column on phones, required fields first; rarely changed
  fields behind a disclosure ("Lisa tulemus või muuda aega ja teostajat"), which opens itself
  when one of them has an error. Typed values survive validation errors.
- **Lists, not tables**: organisation-wide lists are two-column rows on desktop (time/state
  left, content right) that stack on phones. No tables, no card grids.
- **Filters**: a collapsed "Filtrid" panel (GET form, URL parameters), open when filters are active.
- **Pagination**: "Uuemad / Vanemad sissekanded" in the operating log, "Eelmine / Järgmine
  lehekülg" elsewhere; filters stay in the links.
- **Overview ("Mis vajab tähelepanu")**: a three-figure strip (Üle tähtaja · Tähtaeg 14
  päeva jooksul · Kõrged ja kriitilised puudused), each figure a link to the filtered list;
  red only when the figure is above zero. Below, four short lists (5 rows each, count at
  right, "Näita kõiki (n)") — on desktop in two columns, on phones stacked in order of
  urgency — then "Objektid, kus on lahtisi asju" as text counts per site. Real data only:
  no charts, no trends, no percentages.
- **First use**: a numbered checklist (Lisa esimene objekt → Lisa paigaldis → Tee esimene
  käidupäeviku sissekanne); done steps get a green check, the current step shows one
  button. Members who can't create sites see who does it. No tours, no modals.
- **Documents (a link register)**: list rows (link icon, title, category · date, context)
  with **"Ava dokument"** at right — the external link, new tab, `noopener noreferrer`, never
  the raw URL. "Lisa dokument" opens a form with title, **Dokumendi link** ("Lisa link
  dokumendile või kaustale, kus dokument asub.", `https://...`), category and placement; no
  file field anywhere. A document uploaded before 2026-10-08 shows "varasem fail · size",
  opens with "Ava fail" / "Laadi alla" and has "Kustuta fail" (confirmation says it is
  permanent); afterwards "Fail kustutatud — name, time" remains and a link can be added.
- **Photos on a record**: the section "Fotod" shows the **Fotode link** ("Ava link" + host).
  Files added earlier sit under "Varem lisatud failid": images as square thumbnails (2 per
  row on phones) with "Kustuta pilt", other files as rows with "Kustuta fail"; a deleted one
  leaves a muted "Pilt/Fail kustutatud — name, time". Historical files carry a note that they
  can't be changed.

## 5a. Public landing page (implemented, refined 2026-10-02)

**Desktop scale (polish pass 2026-10-02):** the public container is `--k-max-site: 100rem`
(1600 px incl. gutters, gutters up to 64 px); `display-1/2/3` and `lead` grow to 80/72/42/23 px;
`xl` buttons are 60 px tall on desktop; header nav 17 px; small uppercase labels are
13–14 px with modest tracking (0.1–0.12em). No long decorative dashes before labels —
typography and spacing carry hierarchy; list markers are a short volt square. Section
order and palette are unchanged; mobile sizes are unchanged.

Every section sits on the **same container** (`.k-container`, §9) and the same vertical
rhythm (`.k-section`); nothing is positioned against the viewport. Sections:

1. **Header** — two groups, pushed apart: left the logo with "Kuidas töötab?" and
   "Hinnakiri"; right "Logi sisse", "Registreeru" (primary) and the language selector, on the
   same container as the hero. Below 1024 px the bar holds the logo, **"Logi sisse"** (always
   visible), the compact language select and a menu button (`MobileNav`: a disclosure,
   `aria-expanded`/`aria-controls`, no focus trap) whose panel under the header lists
   "Kuidas töötab?", "Hinnakiri" and "Registreeru" (full-width primary); it closes on a
   chosen link, Escape (focus back on the button) and a click outside. One row from 320 px
   (below 360 px the wordmark and spacing tighten slightly; targets stay 44 px). Links come from
   `components/marketing/public-nav.ts`; section links (`SectionLink`) scroll in place and
   never leave `#kuidas-toimib` / `#hinnad` in the address bar (an old `/#hinnad` URL lands
   on the section, then `replaceState` cleans it to `/`). "14 päeva tasuta" stays in the
   hero, never in the header.
2. **Hero** (paper + grain) — 7/5 columns: eyebrow, "Elektripaigaldise käit. Lihtsalt."
   (`text-display-1`, max 80 px — one line from 1440 px up), lead, **Loo konto →** and **Vaata,
   kuidas töötab ↓**, and the one handwritten note "kõik kirjas, mitte kellegi peas".
   Right: the **photo slot** (`hero-visual.tsx`) — intended for licensed switchgear
   photography with a few engineering-markup annotations (PK-01, Viimane kontroll 12.03.,
   Järgmine mõõtmine 04/2027, Puudus kõrvaldatud ✓). Until a licensed photo is in the
   repo it shows the technical drawing; set `HERO_PHOTO` to switch. No stock or
   unlicensed images.
3. **"Excel ei ole käiduraamat."** (deep green) — 4/8 columns; the product's log view
   (static HTML, translated example data) is the proof, contained in the column with a
   volt rule — no laptop mock-up, no bleed off the edge.
4. **Real questions** (paper) — 5/7 columns; editorial numbered rows: question in
   `display-3`, the KAIDLY module and answer at 17 px.
5. **Structure** (paper-2 + grid) — an engineering sheet: Ettevõte → Objekt →
   Elektripaigaldis → busbar → Käidupäevik, Käidukava, Puudused, Dokumendid, with a
   title strip. Plain grid flow; connector lines are borders. Vertical rail on phones.
6. **Mobile entry** (near-black) — "Kirja pandud seal, kus töö tehti.", three numbered
   steps (Ava paigaldis · Lisa sissekanne · Salvesta) and a 340 px phone preview of the
   real form.
7. **Final CTA** (volt) — "Pane järgmine kontroll kirja." in `display-1` with `xl` buttons.
8. **Footer** (near-black) — wordmark, tagline, links, language selector.

Marketing-only tokens: `font-hand` (Caveat, latin-ext + cyrillic, loaded on the landing page
only), `.k-grain`, `.k-grid`. Components: `components/marketing/`. Copy: `t.landing`
(including the preview example data, so previews translate).

## 5c. Onboarding and empty states (2026-10-02)

- **Alustamise juhend** — one compact vertical checklist (not cards), six steps from real
  data (ettevõte loodud → objekt → elektripaigaldis → sissekanne → käidukava tegevus →
  dokument); the current step gets the primary button, blocked steps say why. Shown on the
  overview until complete or hidden ("Peida juhend"); always in **Abi** with the six core
  terms. Deficiencies are optional and never part of completion.
- **Welcome** once after creating an organisation: "Ettevõte on valmis." with "Lisa esimene
  objekt" and "Vaata alustamise juhendit". No tours, no tooltips.
- **Guided empty states** for Objektid, elektripaigaldised, Käidupäevik, Käidukava, Puudused
  and Dokumendid: what the area is for, examples or its sequence (Avatud → Töös →
  Lahendatud; Lisa tegevus → KAIDLY jälgib tähtaega → …), the missing prerequisite with a
  link to it, one action — or who does it for people who can't. Two columns on desktop,
  stacked on phones.
- **Danger zone** (Seaded → Ettevõte, owners): separated by a red rule; deletion page shows
  what exists, explains why permanent deletion isn't available when there is history, and
  needs the exact organisation name before the destructive button enables.
- **Terminology:** the Estonian UI now says *ettevõte* (was *organisatsioon*) everywhere.

## 5b. Change history and language

- **Muudatuste ajalugu** (Settings, owners/admins): rows of time + person, then one plain
  sentence ("Objektid: lisati „Katlamaja“", "Puudus „X“: Avatud → Töös") and "Ava". A
  filter by area. No diffs, no JSON, no charts.
- **Language selector:** quiet — ET · EN · RU as small uppercase buttons (active one
  underlined) in the public header/footer from 1024 px, a compact code select below; in
  the app, the account menu and the account page. Switching re-renders in place.

## 5d. Account, company details and KAIDLY Admin (2026-10-02)

- **Konto** is one column of sections (profile, email, password, language, sign-ins), each
  with a heading and one short explanation; secondary actions are outline buttons.
- **Company details** sit on Seaded → Ettevõte; read-only roles see the same fields as a
  definition list.
- **KAIDLY Admin** must never be mistaken for a customer screen: ink header with a shield
  icon and "KAIDLY Admin", white work surface, a standing grey notice, tab navigation.
  Tables scroll inside their own focusable frame on narrow screens (never the page).
  Confirmations are native dialogs; destructive ones require typing the user's email.
  Estonian-only by design (ARCHITECTURE.md §6d). Urgency colours as elsewhere: danger for
  overdue/critical, warn for due soon/high; normal future dates stay neutral.

## 6. Mobile UX

The app is designed **mobile-first** for the technician on site; desktop gets more columns,
not a different product.

### Navigation

- Bottom tab bar on mobile (thumb zone): **Ülevaade · Päevik · Kava · Puudused · Rohkem** —
  short labels per language (`t.app.navShort`, EN Log/Plan, RU Журнал/План); the full
  term is the accessible name
  (Rohkem = Objektid, Dokumendid, Seaded). Sites are listed on the overview.
- A full-width volt **"+ Lisa sissekanne"** button in the installation header on phones
  (hidden while the entry form itself is open), on the overview and on the organisation log.
  Outside an installation it opens the quick-entry picker.
- Desktop: deep green left sidebar (as on the board): Ülevaade · Objektid · Käidupäevik ·
  Käidukava · Puudused · Dokumendid · Seaded, organisation switcher at the top (Phase 2),
  account menu at the bottom.
- Organisation switcher: name of the current organisation in the header; tap → list.

### The critical flow: add a log entry (as implemented)

```
Installation page ──[+ Lisa sissekanne]──► Entry form ──[Salvesta sissekanne]──► Installation log
   (header button, full width                (type chips, description           ("Sissekanne
    on phones; operators and up)              auto-focused; time = now,           salvestatud.")
                                              performer = you, in a disclosure)
```

- Organisation, site and installation come from the page — never selected again.
- Entry types as large chips: Kontroll · Hooldus · Lülitamine · Rike · Remont · Mõõtmine · Muu.
- Description is focused on open; result, time and performer sit in a disclosure that
  starts with sensible defaults (now, the user's name).
- Measured: from the installation page, two taps (Lisa sissekanne → type chip) plus typing
  and Salvesta. From the overview: Lisa sissekanne → recently used installation → type chip.
- **Photos** are linked, not uploaded: "Fotode link" sits under the description ("Lisa link
  kaustale või albumile, kus fotod asuvad.", placeholder `https://...`, `type="url"`). No
  file or camera control. A correction carries the photo link forward and can change it.

- **Deficiencies** take a photo link (create and edit); no files.
- **Drafts:** new entries, corrections and deficiencies keep unsaved text in this tab
  (sessionStorage) — a reload or lost connection doesn't cost it; "Taastasime … mustandi"
  with "Alusta tühjalt". A lost connection while saving shows the network error and keeps
  everything typed.

**Not built yet:** full offline mode (queued saves), "Leidsin puuduse" from an entry.

### Completing planned work and resolving deficiencies

- "Märgi tehtuks" (activity) and "Lahenda puudus" (deficiency) open a form that *is* the log
  entry, prefilled (type, description = activity name, time = now, performer = you), so the
  same event is never written twice.
- In lists, "Märgi tehtuks" appears only for overdue and due-soon activities; any activity can
  be completed from its own page.

### Touch and field conditions

- Touch targets ≥ 44 × 44 px, ≥ 8 px apart; primary buttons 48 px high.
- Works with gloves: no small icon-only controls for primary actions; no swipe-only gestures.
- High contrast; nothing relies on hover.
- Slow network: pending state on save, clear errors; text is never lost after a validation
  or connection error (tab drafts).
- Respects `prefers-reduced-motion`; motion is minimal anyway (≤ 150 ms fades).

## 7. Copy

- Estonian, plain, short, active voice. "Lisa sissekanne", not "Uue sissekande lisamine".
- Use the field's own vocabulary (see PRODUCT.md §8 glossary).
- Errors say what happened and what to do: "Foto üleslaadimine ebaõnnestus. Proovi uuesti — tekst on salvestatud."
- Three languages: Estonian (default), English, Russian — `lib/i18n/{et,en,ru}.ts`, same
  keys (typecheck + unit test). One term per concept in every language (PRODUCT.md §8).
- Russian copy is professional, not literal; it needs native electrical-professional
  review before public launch.

## 8. Open items

- [x] colour values → §2
- [x] typefaces → §3
- [ ] production logo as SVG (mark, wordmark, three variants), app icon, favicon — provisional placeholders in use (D19)
- [ ] choose the handwritten face against the board
- [ ] photography: the board's photos look illustrative/generated; production marketing needs real, licensed photos (D11)
- [ ] paper / concrete texture assets

## 8a. UX polish (2026-10-03)

- **App width:** `--k-max-app` 92rem (1472 px incl. gutters, ~1390 px content), still aligned
  to the sidebar. Long text keeps its own max widths; nothing stretches edge to edge.
- **Overview while onboarding:** guide (left) + a "Meeldetuletused ja tähtajad" card (right,
  ≥ 1280 px) linking to Abi — real guidance, no invented dashboard content.
- **Trial status:** a quiet bordered panel with a clock badge; a warn edge only in the last
  3 days; expired stays the clear read-only notice. Not a live region.
- **Onboarding:** progress bar (`role="progressbar"`, same numbers as "1/6 tehtud"), round
  step numbers, stronger titles, blocked reason as a calm grey tag.
- **Sidebar:** 4 px rhythm, active item with volt edge + faint inner outline, softer hover.
- **Landing hero:** engineering-paper grid (40 px fine / 200 px major lines, CSS gradients) is
  the main layer; the soft panels are secondary (≈ 55 % opacity) and masked away from the
  text; phones get a 32 px lighter grid.
- **Reminders on the landing:** "KAIDLY tuletab ise meelde." — six steps and a static HTML
  mock-up of the notification centre using the real countdown wording; the "Kuidas
  töötab" anchor now lands on the structure section (site → installation → log/plan → reminders).
- **Scroll to top:** round 48 px button bottom-right on long public pages, after about one
  viewport, lifted above the footer, smooth unless reduced motion, focus returns to the header.
- **Installation quick actions (V1):** a small "Lisa sellele paigaldisele" row of outline
  buttons (deficiency, plan activity for admins, document) under the status line; the
  primary "Lisa sissekanne" stays in the header. Only for roles and companies that can write.
- **Import wizard (V1):** three numbered steps on one page (type as bordered radio tiles,
  file input, preview table in a scrollable bordered box with sticky header); invalid rows
  tinted with the reason in plain words; the import button only appears when every row is
  valid. Success is a left-bordered status block, like other confirmations.

- **Auth pages (2026-10-03):** one shell for login, sign-up, password reset, update
  password, sign-up success and error — a simplified header (logo, "Tagasi avalehele",
  languages; on phones the back link is an arrow), the landing grid at lower contrast,
  faded behind the form, with faint panels only on wide screens, and one ~430 px card
  (hairline border, 1 px shadow) placed a little above the visual centre; below 360 px the
  card goes edge to edge. 48 px inputs, password show/hide buttons, a length hint that
  turns green, an inline mismatch message, a spinner on the primary button, the
  login/sign-up switch under a hairline at the bottom of the card.
- **Hero drawing as a maintenance sheet (2026-10-03):** the right-hand visual is a light
  grid-paper sheet (hairline border, soft shadow, 0.6° tilt from lg) instead of the dark
  green panel. Layer 1 is the neat ink drawing of PK-01 (cabinet, breaker rows, meter,
  dimension line, title block); layer 2 is green "field notes" in the tagline's Caveat face —
  bowed pen arrows, ticks, a circle round a breaker, a circled date and four short labels
  (kontroll tehtud · mõõtmine 04/2027 · järgmine hooldus · puudus kõrvaldatud). Phones drop the
  row ticks and the date. A faint dashed pencil trace leads from the copy to the sheet on xl.
  Headline, copy and buttons unchanged.
## 9. Layout system (2026-10-02)

**Audit before refactoring** (screenshots at 375/768/1280/1440/1920): no page scrolled
sideways, but — landing: the hero drawing ran into the section edge, the product preview
ran off the right edge (negative-margin bleed), sections used different widths, the
structure diagram was small and weak, buttons tiny next to the headings, the phone preview
small; app: content centred in the space right of the sidebar (a large empty band at 1920),
negative-margin bleed in the installation tabs, two negative-margin nudges, fixed row
heights, 16 px phone gutters. Later testing found: buttons that couldn't wrap (long and
translated labels), grids whose implicit columns grew with content, the bottom bar's
Russian labels overlapping, the public header too wide at 320 px.

**The system** (only what removes real duplication):

| Concept | Implementation |
|---|---|
| Gutters | `--k-gutter` clamp(20 → 48 px) public, `--k-gutter-app` clamp(20 → 40 px) app |
| Public container | `.k-container` — centred, max 86rem incl. gutters, 12-column grids inside |
| App container | `.k-app-container` — aligned to the navigation, max 78rem, fluid gutters |
| Section rhythm | `.k-section` — clamp(72 → 144 px) vertical padding |
| Reading width | `.k-measure` (44rem) for forms and running text |
| Type | `display-1/2/3`, `lead` (§3) |
| Buttons | min-heights 44/48/56 px, labels may wrap; `xl` for marketing CTAs |
| Page header, empty state, filter panel, status marks, form messages | existing components (`components/app`, `components/forms`) |

**Rules** (enforced by `e2e/layout.spec.ts`): no horizontal page scroll at 320–1440 px or
with 125 %/200 % text; no control or heading crossing the viewport edge (content in its own
scroll strip, like the installation tabs, is fine); grids use `minmax(0,1fr)` tracks and
flex/grid children `min-w-0`; long words break (`overflow-wrap: break-word` on body,
hyphenation on headings via `lang`); form controls have `min-width: 0`; no negative-margin
patches; absolute positioning only for decorative layers; no `overflow-x: hidden` to hide
bugs.

**Remaining design debt:** real licensed photography for the hero (D11); production logo
SVGs; the dashboard and lists are good but not yet tested with very large organisations;
a native Russian review may shorten some labels further.
