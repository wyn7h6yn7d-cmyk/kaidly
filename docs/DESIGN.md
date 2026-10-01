# KAIDLY — Design

Status: implemented for Phases 1–6 (tokens, fonts, primitives, provisional logo, app shell, all product screens). Public landing page implemented (§5a); real photography still to be licensed (D11).

Source: [`design/KAIDLY-brand-board.png`](../design/KAIDLY-brand-board.png) plus the written
brief. Where the two differ, this document records which one wins and why.

---

## 0. What the brand board establishes

- **Logo**: a slanted green lightning-bolt mark + heavy geometric wordmark `KAIDLY`.
  Variants: dark on light, light on dark (black tile), black mono. App icon: green bolt on a
  near-black rounded square. Descriptor line: *ELECTRICAL OPERATIONS. SIMPLIFIED.* /
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
- Status is never colour-only: always colour + word or icon ("Üle tähtaja · 3 päeva").
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
- Estonian formats via `Intl`: `12.03.2026`, `14:05`, decimal comma.

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

## 5a. Public landing page (implemented)

Sections, alternating surfaces for rhythm:

1. **Header** (paper).
2. **Hero** (paper + grain): the full-width oversized headline (Manrope 800; on phones it
   breaks after "Elektripaigaldise" so it can stay large), then the lead and CTAs left
   (Loo konto / Logi sisse) and the deep green "photo slot" right. The slot holds a
   technical line drawing of a switchboard with callouts and a drawing title block —
   until real switchgear photography is licensed (D11), when the photo goes underneath.
   One handwritten note: "kõik kirjas, mitte kellegi peas", with its arrow pointing right on
   desktop and down on phones.
3. **"Excel ei ole käiduraamat."** (deep green): editorial text left; the product's log view
   (static HTML, fictional data) bleeding off the right edge — no laptop mock-up.
4. **Real questions** (paper): numbered rows split by hairlines — question in display type,
   KAIDLY's answer with the module name. No cards.
5. **Structure** (paper-2 + technical grid): drawn as a single-line diagram — Objekt →
   Elektripaigaldis → busbar → Käidupäevik, Käidukava, Puudused, Dokumendid; terminal
   squares, drawing indices (A, B, Q1–Q4); vertical trunk on phones. Second handwritten
   note: "üks koht, mitte kümme faili".
6. **On the phone** (near-black): phone-sized entry form preview and the three steps.
7. **Final CTA** (volt, ink text 8.8 : 1).
8. **Footer** (near-black).

Marketing-only tokens (not used in the application UI):

| Token | Where | What |
|---|---|---|
| `font-hand` / `--font-hand` | `tailwind.config.ts`; loaded in `app/page.tsx` only | Caveat 600 (latin-ext) for handwritten notes |
| `.k-grain` | `app/globals.css` | inline SVG fractal-noise paper grain at 5 % opacity |
| `.k-grid` | `app/globals.css` | 24 px technical grid in `currentColor` (set very low alpha via `text-…/[0.05]`) |

Components: `components/marketing/` (`hero-figure`, `hand-note`, `log-preview`,
`phone-preview`, `system-diagram`). Copy lives in `t.landing`. Verified at 375, 768 and
1440 px: no horizontal overflow, no axe violations, one h1.

## 6. Mobile UX

The app is designed **mobile-first** for the technician on site; desktop gets more columns,
not a different product.

### Navigation

- Bottom tab bar on mobile (thumb zone): **Ülevaade · Käidupäevik · Käidukava · Puudused · Rohkem**
  (Rohkem = Objektid, Dokumendid, Seaded). Sites are listed on the overview.
- A full-width volt **"+ Lisa sissekanne"** button in the installation header on phones.
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
  and Salvesta.

**Not built yet (planned):** an installation picker with recently used installations
(entry point from the overview), photo capture (Phase 7), device-side drafts for poor
signal (Phase 9), "Leidsin puuduse" shortcut that creates a deficiency from an entry.

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
- Slow network: optimistic pending state on save, clear retry on failure, text never lost.
- Respects `prefers-reduced-motion`; motion is minimal anyway (≤ 150 ms fades).

## 7. Copy

- Estonian, plain, short, active voice. "Lisa sissekanne", not "Uue sissekande lisamine".
- Use the field's own vocabulary (see PRODUCT.md §8 glossary).
- Errors say what happened and what to do: "Foto üleslaadimine ebaõnnestus. Proovi uuesti — tekst on salvestatud."
- All strings live in `lib/i18n/et.ts` so English can be added later without hunting through components.

## 8. Open items

- [x] colour values → §2
- [x] typefaces → §3
- [ ] production logo as SVG (mark, wordmark, three variants), app icon, favicon — provisional placeholders in use (D19)
- [ ] choose the handwritten face against the board
- [ ] photography: the board's photos look illustrative/generated; production marketing needs real, licensed photos (D11)
- [ ] paper / concrete texture assets
