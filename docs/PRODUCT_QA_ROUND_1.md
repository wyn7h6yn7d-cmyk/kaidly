# KAIDLY — Product QA, round 1

Date: 2026-10-04/05 · Start `028591a` · Local Supabase with the QA fixtures
(`npm run qa:fixtures -- --perf`): QA Elektritööd OÜ (trial; 2 sites, 6 installations, 34
entries, 10 activities, reminders, 5 deficiencies, documents, corrections), QA Tööstuspark OÜ
(active; 8 sites, 24 installations, 160 entries, 42 activities, 20 deficiencies, 30 documents,
44 reminders), QA Haldus OÜ (expired), QA Suletud OÜ (deactivated), QA Jõudlus (2000 entries,
500 activities, 300 deficiencies, 500 documents) and a multi-company user.

Baseline: lint, typecheck, build ✔ · unit 100 · pgTAP 667 · E2E 184 (previous run).

## 1. Workflows tested (real browser sessions, scripted)

- **First use** (brand-new user): create company → guide → first site → installation →
  log entry → plan activity → document; guide progress updates on every return.
- **Installation-centric field work** (owner, operator): header "Lisa sissekanne", quick
  actions (deficiency, activity, document) with the installation preselected, entry
  double-click, correction, deficiency → in progress → resolved, activity completion
  (on time, late, one-time), installation summary.
- **Mobile** 320×568, 375×667, 390×844, 430×932: entry, deficiency, activity, document,
  import, installation, notifications, search — no overflow, every primary button tappable
  (not covered by the bottom navigation).
- **Roles**: owner, operator, viewer across all company pages; **access states**: trial
  banner, active (no banner), expired (banner on every page, no write CTAs), deactivated.
- **Languages**: core pages in ET, EN and RU at 320/375/1440 px; **200 % text** at 375 px.
- **Documents**: invalid type, > 25 MB, 190-character Unicode file name.
- **Reports**: all six reports as PDF (and CSV where tabular) — opened and read.
- **Search**: common, rare, identifier, file name, Cyrillic, wildcard/quote input, 300-char query.

## 2–5. Bugs and UX problems found → fixed

| # | Type | Problem | Fix | Regression |
|---|---|---|---|---|
| 1 | UX | A new company's overview showed the full "Mis vajab tähelepanu" grid (three zeros, four empty lists) and "Objektid, kus on lahtisi asju" under the getting-started guide | Shown once there is something in it, or once the guide is done/hidden | existing dashboard/lifecycle tests (data present) |
| 2 | Bug (layout) | 200 % text at 375 px: `/konto`, `/teavitused`, `/otsing` scrolled sideways (header couldn't wrap) | Plain header wraps | new layout test |
| 3 | Bug (layout) | 200 % text: members page and company settings scrolled sideways (role form row, settings tabs, inputs' intrinsic width inside `Field` grids) | Role form wraps; tabs scroll inside their strip; `Input` `min-w-0`; `Field` `minmax(0,1fr)` track | new layout test |
| 4 | Bug (layout) | Long words in notification titles overflowed | `overflow-wrap:anywhere` | new layout test |
| 5 | UX | Activity form: the priority select sat ~34 px lower than the due-date input next to it | `Field` grids align content to the start (fixes all side-by-side fields) | measured |
| 6 | Copy | Site/installation summaries said "Valitud filtritega kirjeid ei leitud" for empty sections although summaries have no filters | Neutral "Kirjeid ei ole." (ET/EN/RU) | reports E2E |
| 7 | UX | Search said "6 tulemust" when thousands matched (6 per group cap, not explained) | "Igas rühmas näidatakse kuni 6 tulemust. Täpsusta otsingut…" when a group is full | new search E2E |
| 8 | Bug | Document title suggested from a very long file name could end in a space after the 200-character cap (rejected by the database) | trim after the cap | unit test |

## 6–8. Mobile, tablet, desktop

Mobile: no overflow or hidden actions at 320–430 px; forms reachable above the bottom bar;
long names wrap. Tablet/desktop (from the V1 pass, re-checked on changed pages): content
within the app width, tables use it, forms stay narrow.

## 9–10. Roles and access states

No viewer write CTAs anywhere; operators see only their actions; expired company: clear
banner on every page, no write CTAs, reads/reports available; database refusals verified in
the security suite. No discrepancies.

## 11–14. Log, plan/reminders, deficiencies, documents

Double-clicked save created one entry; correction relationship shown; completion message
names the next due date ("Järgmine tähtaeg: 11.10.2026.") or "Ühekordne tegevus on
lõpetatud."; deficiency resolution final with a clear note; upload errors name the file
and the rule (type list, 25 MB). Reminder thresholds and countdown wording correct.

## 15–17. Import, search, reports

Import covered by its E2E suite (valid, invalid, duplicate, missing site, semicolon, double
submit) — no new defects. Search: results show type, company, site, installation and date;
odd input safe; fixed #7; recorder-name search moved to the backlog (needs a migration).
Reports: PDFs have header/footer/page numbers, Estonian and Cyrillic glyphs, readable tables;
CSV with BOM, semicolons, formula protection; ASCII file names; fixed #6.

## 18–20. Admin, accessibility, localisation

Admin flows unchanged and covered by their E2E suite. Accessibility: axe sweeps (desktop,
tablet, phone) pass, including the changed pages. EN/RU: no overflow at 320/375/1440;
Russian wording still needs the planned native review.

## 21. Remaining issues

None blocking. Pre-launch items unchanged (legal operator facts, SMTP, mailbox, backups).

## 22. Future ideas (added to IMPLEMENTATION_PLAN.md)

AA recorder-name search · AB search "show more" · AC category suggestion from the file name.

## 23–29. Totals and release

| | |
|---|---|
| Unit | **101** passed |
| Database (pgTAP) | **667** passed (20 files) |
| E2E | **186** passed (2 workers). With 4 workers the long 320–1440 px layout test hit its 8-minute timeout twice while the machine was under heavy external load (load average ≈ 24: macOS file sync at ~190 % CPU); the same test passes alone (4.4 min) and in the 2-worker run — a machine-load timeout, not an application regression |
| Lint, typecheck, build | pass |
| Migrations | none |
| Release | see the final summary (commit, kaidly.ee health) |
