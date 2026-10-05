# KAIDLY — Performance, scale and reliability audit

Date: 2026-10-05 · start `0f47c5b` · LOCAL Supabase only (never Production).

## 1. Dataset

`npm run qa:fixtures -- --perf --scale` (new `supabase/qa/qa_scale.sql`, deterministic, local-only
guard as the other fixtures; loads in ~26 s):

| | rows |
|---|---|
| companies | 101 scale + 6 QA (incl. one large customer "QA Suurklient OÜ") |
| users / memberships | 501 / 501 |
| sites | 600 |
| installations | 3,500 |
| log entries | 75,000 (large customer: 25,000) |
| scheduled activities | 15,000 (large customer: 5,000) |
| deficiencies | 7,000 (large customer: 2,000) |
| document metadata rows | 15,000 (no Storage objects) |
| notifications | ~15,600 (real generator, 30 days of history) |

The large customer is larger than expected early use (100 sites, 1,000 installations).

## 2. Method

Local **production build** (`next build && next start`) against the local stack; Playwright
loads each page in a warm signed-in session; `pg_stat_statements` is reset before each page
and read after it (calls, distinct statements, total execution time). EXPLAIN ANALYZE and
`auto_explain` (nested statements) run as the real user (`role authenticated` + JWT claims),
so RLS is included. Wall times include Playwright's 500 ms network-idle wait.

## 3. Baseline at scale (large customer, platform admin)

```
/o/qa-suurklient                                               919 ms | db calls  10 (9 distinct) 33.6 ms
/o/qa-suurklient/objektid                                      917 ms | db calls   9 (9 distinct) 23.8 ms
/o/qa-suurklient/objektid/8ab4f0de-2f49-41fd-ba4d-da7a426e26   908 ms | db calls   6 (6 distinct) 23.0 ms
/o/qa-suurklient/paigaldised/aca82fed-1a4e-4b42-85cb-602e57f   920 ms | db calls   6 (6 distinct) 21.7 ms
/o/qa-suurklient/paigaldised/aca82fed-1a4e-4b42-85cb-602e57f   917 ms | db calls  12 (12 distinct) 24.8 ms
/o/qa-suurklient/paevik                                        907 ms | db calls  10 (9 distinct) 23.8 ms
/o/qa-suurklient/kaidukava                                     925 ms | db calls   6 (6 distinct) 23.6 ms
/o/qa-suurklient/puudused                                      917 ms | db calls   6 (6 distinct) 23.2 ms
/o/qa-suurklient/dokumendid                                    902 ms | db calls   8 (8 distinct) 27.7 ms
/teavitused                                                    864 ms | db calls  12 (11 distinct) 44.6 ms
/otsing?q=kontroll                                             880 ms | db calls   6 (6 distinct) 69.4 ms
/otsing?q=P-7                                                  876 ms | db calls   3 (3 distinct) 74.5 ms
/o/qa-suurklient/aruanded/log                                  900 ms | db calls   7 (7 distinct) 24.9 ms
/o/qa-suurklient/aruanded/plan                                 944 ms | db calls   9 (8 distinct) 22.8 ms
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

page.goto: Download is starting
Call log:
[2m  - navigating to "http://localhost:3300/o/qa-suurklient/aruanded/log/eksport?format=csv", waiting until "networkidle"[22m

    at /private/tmp/claude-501/-Users-kennethalto/45c6f6fd-87fb-42e0-bbd8-c3ce756b18ba/scratchpad/perf/pages.mjs:11:11 {
  log: [
    '  - navigating to "http://localhost:3300/o/qa-suurklient/aruanded/log/eksport?format=csv", waiting until "networkidle"'
  ],
  name: 'Error'
}

Node.js v24.14.0
/o/qa-suurklient/aruanded/log/eksport?format=csv               117 ms | db calls   1 (1 distinct) 0.8 ms | 735 kB
/o/qa-suurklient/aruanded/log/eksport?format=pdf              1133 ms | db calls   9 (8 distinct) 0.9 ms | 1512 kB
/o/qa-suurklient/aruanded/plan/eksport?format=pdf             1210 ms | db calls  16 (13 distinct) 1.1 ms | 1642 kB
/o/qa-suurklient/aruanded/deficiencies/eksport?format=pdf      411 ms | db calls   5 (5 distinct) 0.8 ms | 582 kB
/o/qa-suurklient/sissekanne                                   1090 ms | db calls   9 (9 distinct) 39.1 ms
/o                                                            1245 ms | db calls   8 (6 distinct) 74.6 ms
/admin                                                         847 ms | db calls   6 (6 distinct) 16.5 ms
/admin/companies                                               866 ms | db calls  14 (14 distinct) 6.0 ms
/admin/users                                                   879 ms | db calls  14 (11 distinct) 2.9 ms
/admin/deadlines                                              3141 ms | db calls  17 (10 distinct) 237.3 ms
/admin/system                                                  851 ms | db calls  10 (10 distinct) 7.6 ms
/admin/audit                                                   859 ms | db calls   8 (7 distinct) 3.0 ms
```

## 4. Findings

| Area | Finding | Action |
|---|---|---|
| Overview, lists, installation, site, plan, deficiencies, documents, log | 6–12 DB calls per page, every statement distinct (no N+1), 20–45 ms DB time; lists paginated; no signed URLs in lists | none |
| **Admin deadlines** | `admin_deadlines` returned **every** row: 8,925 rows / 4.3 MB JSON, page 3.1 s | **fixed**: at most the 500 most urgent rows + true total (migration `20261005100000_admin_deadlines_limit`); site filter moved into the database; page says "Näidatakse 500 kõige pakilisemat 8925-st…" → **0.9 s, 47 ms DB, 248 kB** |
| **Global search** | a common word ("kontroll", 25,500 matching entries) took **180–280 ms**: planner estimated 7 rows and joined installation/site/company per row before the limit | **fixed**: newest matches first, names joined for those rows only (migration `20261005110000_search_log_topn`, same signature, still SECURITY INVOKER) → **35–47 ms**, identical results |
| Notifications | `my_notifications` ≈ 12 ms in Postgres (35 ms incl. API) with 1,743 unread; indexes used; called twice per page (bell + toast) | acceptable; noted |
| Reports | CSV log at the 5,000-row cap 117 ms / 735 kB; PDF log 1.1 s / 1.5 MB; PDF plan 1.2 s / 1.6 MB; cap is server-side | none (cap kept) |
| Import | 1,000 sites 0.21 s; 1,000 installations 0.71 s; one transaction, idempotent token | none |
| Reminder job | full run over 15,000 activities ≈ 40 ms; second run creates 0 rows (idempotent); jobs exist exactly once (`kaidly-activity-reminders` 03:15, `kaidly-upload-events-cleanup` 03:40) | none |
| Mark all read | 1,743 rows in 19 ms | none |
| Admin overview/companies/users/system/audit (100+ companies, 500+ users) | 3–17 ms DB; lists paginated (≤ 200/500) | none |
| Indexes | 89 in public/private, no duplicates; trigram indexes used for selective searches (a seq scan is correct for very common words) | no index added — none needed by evidence |
| Client payload / bundles | see PERFORMANCE_AUDIT.md (zod and fonts) | fixed in pass 1 |

## 5. Regression coverage

pgTAP `190_admin_deadlines_limit` (cap, total, order, filters, admins only); existing search
suite (`160_global_search`) covers the rewritten function (results, isolation,
deactivated companies, wildcards); unit `client-boundaries` (bundles).

## 6. When did degradation start? (synthetic local data — not capacity limits)

- **Admin deadlines**: noticeable from a few thousand open deadlines platform-wide
  (8,925 rows → 3 s); now bounded at 500 rows regardless of size.
- **Global search**: with ~25,000 matching log entries for one user (common words);
  rare words and identifiers stayed ~35 ms. Fixed.
- Everything else showed no noticeable degradation at this size (75,000 log entries,
  15,000 activities/documents, 500 users).

## 7. Remaining scale limits

- Log PDF at the 5,000-row cap takes ~1.1 s and 1.5 MB — fine for on-demand exports.
- Notifications are read twice per page (~12 ms each in Postgres) — a candidate for one
  shared request-level fetch if user notification counts grow far beyond thousands.
- Search across *all* words of huge histories will eventually need full-text search; not
  needed at this size.
