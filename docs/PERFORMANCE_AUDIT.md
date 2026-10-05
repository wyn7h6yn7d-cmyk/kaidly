# KAIDLY — Website speed / Core Web Vitals audit

Date: 2026-10-05 · start `2c0c6d8`.

## Method

Playwright + Chrome DevTools Protocol (no new dependency): cold cache, 3 runs per page, median.
TTFB/FCP from Navigation/Paint Timing, LCP and CLS from PerformanceObserver, bytes from
`Network.loadingFinished.encodedDataLength` (transferred, compressed). Profiles: **desktop**
1440×900 unthrottled; **mobile** 390×844, 4× CPU slowdown, 150 ms RTT, 1.6 Mbit/s down.
Public pages measured live on kaidly.ee and on a local production build; authenticated pages
on a local production build against the local stack with the large QA dataset (`qa-joudlus`:
2000 entries, 500 activities, 500 documents). INP is not measured (no real interaction trace).

## Baseline (live kaidly.ee, before)

```
desktop / | TTFB 48 | FCP 628 | LCP 628 | CLS 0.000 | JS 269 kB | total 649 kB | req 33 | 3rd 0 | DOM 544 | HTML 20 kB
desktop /auth/login | TTFB 43 | FCP 480 | LCP 480 | CLS 0.000 | JS 264 kB | total 616 kB | req 33 | 3rd 0 | DOM 116 | HTML 7 kB
desktop /auth/sign-up | TTFB 44 | FCP 528 | LCP 528 | CLS 0.000 | JS 258 kB | total 607 kB | req 30 | 3rd 0 | DOM 126 | HTML 7 kB
mobile / | TTFB 43 | FCP 1208 | LCP 1208 | CLS 0.000 | JS 269 kB | total 648 kB | req 33 | 3rd 0 | DOM 541 | HTML 20 kB
mobile /auth/login | TTFB 47 | FCP 972 | LCP 972 | CLS 0.000 | JS 264 kB | total 616 kB | req 33 | 3rd 0 | DOM 115 | HTML 7 kB
mobile /auth/sign-up | TTFB 42 | FCP 936 | LCP 936 | CLS 0.000 | JS 258 kB | total 607 kB | req 30 | 3rd 0 | DOM 125 | HTML 7 kB
```

Public pages were already within the CWV targets (LCP < 2.5 s, CLS 0). Bottlenecks found:

1. **Fonts — 338 kB of 649 kB on the landing**: 9 font files preloaded on every page via the
   `Link` header (Inter, Manrope and Caveat each in Latin, Latin Extended and Cyrillic;
   Manrope additionally as three static weights).
2. **zod in the client bundle** (≈ 357 kB raw) on every authenticated page:
   `lib/actions/state.ts` (used by `ConfirmForm` everywhere) imported a zod helper, and
   client forms imported constant lists from zod-based validation modules.
3. No third-party requests; no CLS; TTFB ≈ 45 ms (landing served from Vercel's cache; the
   proxy does no network call without a session); pdfmake server-only; only the active
   locale's dictionary is shipped.

## Fixes

| Fix | Evidence |
|---|---|
| Preload only the `latin` subset of Inter, Manrope and Caveat; Latin Extended and Cyrillic stay declared via `unicode-range` and load on demand (Estonian õäöü are in Latin) | preloads 9 → 3; all subsets still in the CSS; screenshots identical |
| Manrope as one variable font instead of three static weights | fewer files, same rendering |
| `lib/actions/state.ts` zod-free (type-only import) | zod gone from shared client code |
| Constant lists moved to zod-free `lib/validation/constants.ts` (re-exported by the validation modules) | only the account e-mail form still validates with zod in the browser (account page only) |
| Regression guard `tests/unit/client-boundaries.test.ts`: no client import chain reaches pdfmake/report code or zod (except that form); fonts preload only Latin | mutation-checked |

## After (local production build, same method)

Before:
```
desktop / | TTFB 6 | FCP 100 | LCP 100 | CLS 0.000 | JS 274 kB | total 667 kB | req 33 | 3rd 0 | DOM 542 | HTML 24 kB
desktop /auth/login | TTFB 3 | FCP 36 | LCP 36 | CLS 0.000 | JS 269 kB | total 630 kB | req 33 | 3rd 0 | DOM 116 | HTML 8 kB
desktop /o/qa-joudlus | TTFB 3 | FCP 356 | LCP 356 | CLS 0.000 | JS 377 kB | total 708 kB | req 65 | 3rd 0 | DOM 691 | HTML 24 kB
desktop /o/qa-joudlus/paevik | TTFB 3 | FCP 364 | LCP 364 | CLS 0.000 | JS 379 kB | total 704 kB | req 54 | 3rd 0 | DOM 1308 | HTML 42 kB
desktop /o/qa-joudlus/kaidukava | TTFB 4 | FCP 356 | LCP 356 | CLS 0.000 | JS 379 kB | total 709 kB | req 56 | 3rd 0 | DOM 1498 | HTML 43 kB
desktop /o/qa-joudlus/dokumendid | TTFB 4 | FCP 360 | LCP 360 | CLS 0.000 | JS 379 kB | total 700 kB | req 53 | 3rd 0 | DOM 1237 | HTML 40 kB
desktop /o/qa-joudlus/aruanded | TTFB 3 | FCP 352 | LCP 352 | CLS 0.000 | JS 377 kB | total 666 kB | req 49 | 3rd 0 | DOM 306 | HTML 15 kB
desktop /otsing?q=kontroll | TTFB 2 | FCP 28 | LCP 344 | CLS 0.000 | JS 377 kB | total 636 kB | req 36 | 3rd 0 | DOM 145 | HTML 12 kB
mobile / | TTFB 4 | FCP 1284 | LCP 1284 | CLS 0.000 | JS 274 kB | total 667 kB | req 33 | 3rd 0 | DOM 542 | HTML 24 kB
mobile /auth/login | TTFB 3 | FCP 872 | LCP 872 | CLS 0.000 | JS 269 kB | total 630 kB | req 33 | 3rd 0 | DOM 116 | HTML 8 kB
mobile /o/qa-joudlus | TTFB 3 | FCP 964 | LCP 964 | CLS 0.000 | JS 377 kB | total 664 kB | req 43 | 3rd 0 | DOM 691 | HTML 24 kB
mobile /o/qa-joudlus/paevik | TTFB 3 | FCP 1184 | LCP 1184 | CLS 0.000 | JS 379 kB | total 683 kB | req 44 | 3rd 0 | DOM 1307 | HTML 41 kB
mobile /o/qa-joudlus/kaidukava | TTFB 4 | FCP 1204 | LCP 1204 | CLS 0.000 | JS 379 kB | total 688 kB | req 46 | 3rd 0 | DOM 1497 | HTML 43 kB
mobile /o/qa-joudlus/dokumendid | TTFB 3 | FCP 1140 | LCP 1140 | CLS 0.000 | JS 379 kB | total 685 kB | req 46 | 3rd 0 | DOM 1236 | HTML 40 kB
mobile /o/qa-joudlus/aruanded | TTFB 3 | FCP 912 | LCP 912 | CLS 0.000 | JS 377 kB | total 654 kB | req 43 | 3rd 0 | DOM 305 | HTML 14 kB
mobile /otsing?q=kontroll | TTFB 2 | FCP 896 | LCP 896 | CLS 0.000 | JS 377 kB | total 636 kB | req 36 | 3rd 0 | DOM 145 | HTML 12 kB
```
After:
```
desktop / | TTFB 4 | FCP 92 | LCP 92 | CLS 0.000 | JS 274 kB | total 465 kB | req 27 | 3rd 0 | DOM 536 | HTML 24 kB
desktop /auth/login | TTFB 4 | FCP 32 | LCP 32 | CLS 0.000 | JS 269 kB | total 428 kB | req 27 | 3rd 0 | DOM 110 | HTML 8 kB
desktop /o/qa-joudlus | TTFB 4 | FCP 356 | LCP 356 | CLS 0.000 | JS 287 kB | total 483 kB | req 61 | 3rd 0 | DOM 686 | HTML 24 kB
desktop /o/qa-joudlus/paevik | TTFB 2 | FCP 352 | LCP 352 | CLS 0.000 | JS 289 kB | total 476 kB | req 49 | 3rd 0 | DOM 1302 | HTML 41 kB
desktop /o/qa-joudlus/kaidukava | TTFB 6 | FCP 368 | LCP 368 | CLS 0.000 | JS 289 kB | total 481 kB | req 51 | 3rd 0 | DOM 1492 | HTML 43 kB
desktop /o/qa-joudlus/dokumendid | TTFB 3 | FCP 356 | LCP 356 | CLS 0.000 | JS 289 kB | total 474 kB | req 49 | 3rd 0 | DOM 1231 | HTML 40 kB
desktop /o/qa-joudlus/aruanded | TTFB 3 | FCP 348 | LCP 348 | CLS 0.000 | JS 287 kB | total 443 kB | req 46 | 3rd 0 | DOM 300 | HTML 14 kB
desktop /otsing?q=kontroll | TTFB 2 | FCP 24 | LCP 344 | CLS 0.001 | JS 286 kB | total 408 kB | req 30 | 3rd 0 | DOM 140 | HTML 12 kB
mobile / | TTFB 3 | FCP 784 | LCP 784 | CLS 0.000 | JS 274 kB | total 465 kB | req 27 | 3rd 0 | DOM 536 | HTML 24 kB
mobile /auth/login | TTFB 3 | FCP 660 | LCP 660 | CLS 0.000 | JS 269 kB | total 428 kB | req 27 | 3rd 0 | DOM 110 | HTML 8 kB
mobile /o/qa-joudlus | TTFB 4 | FCP 672 | LCP 672 | CLS 0.000 | JS 287 kB | total 437 kB | req 38 | 3rd 0 | DOM 686 | HTML 24 kB
mobile /o/qa-joudlus/paevik | TTFB 3 | FCP 716 | LCP 716 | CLS 0.000 | JS 289 kB | total 457 kB | req 39 | 3rd 0 | DOM 1303 | HTML 41 kB
mobile /o/qa-joudlus/kaidukava | TTFB 3 | FCP 724 | LCP 724 | CLS 0.000 | JS 289 kB | total 461 kB | req 41 | 3rd 0 | DOM 1492 | HTML 43 kB
mobile /o/qa-joudlus/dokumendid | TTFB 3 | FCP 708 | LCP 708 | CLS 0.000 | JS 289 kB | total 458 kB | req 41 | 3rd 0 | DOM 1231 | HTML 40 kB
mobile /o/qa-joudlus/aruanded | TTFB 3 | FCP 660 | LCP 660 | CLS 0.000 | JS 287 kB | total 428 kB | req 38 | 3rd 0 | DOM 301 | HTML 15 kB
mobile /otsing?q=kontroll | TTFB 2 | FCP 652 | LCP 652 | CLS 0.000 | JS 286 kB | total 410 kB | req 31 | 3rd 0 | DOM 140 | HTML 12 kB
```

| | Before | After |
|---|---|---|
| Landing transferred | 667 kB / 33 requests | **465 kB / 27 requests (−30 %)** |
| Landing LCP mobile | 1284 ms | **784 ms** |
| Login LCP mobile | 872 ms | **660 ms** |
| App pages JS | 377–379 kB | **286–289 kB (−24 %)** |
| App pages transferred | 636–709 kB | **408–483 kB** |
| App pages LCP mobile | 896–1204 ms | **652–724 ms** |
| CLS | 0 | 0 (≤ 0.001) |

Live verification after deployment: see below.
