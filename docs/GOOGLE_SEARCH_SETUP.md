# KAIDLY — Google Search setup (Estonia first)

KAIDLY's public site is aimed at the **Estonian market**. The root page `https://kaidly.ee/`
is the one indexable product page; it is served in **Estonian to every visitor without a
language cookie** (crawlers never send one; `Accept-Language` is ignored), with `lang="et"`,
`og:locale` `et_EE`, canonical `https://kaidly.ee`, and JSON-LD in Estonian. EN/RU are
usability languages on the same URL via a cookie — no `hreflang` (there are no separate
language URLs), and Vercel's cached page never stores a cookie variant (verified: requests
without a cookie always get Estonian, also right after EN/RU requests).

Application pages (`/o`, `/admin`, `/auth`, `/konto`, …) and the draft legal pages are
`noindex` and out of the sitemap; they are protected by sign-in regardless of crawler rules.

> **Status 2026-10-07:** Google Search Console domain property verified, sitemap accepted,
> homepage indexed. Bing Webmaster Tools configured (§5). Do not change either setup without
> a reason; the checks are in MANUAL_SMOKE_TEST.md §1.

What crawlers get (code: `app/robots.ts`, `app/sitemap.ts`, `lib/site.ts`, `next.config.ts`):

| | |
|---|---|
| `robots.txt` | allows `/`, `/privaatsus`, `/kasutustingimused`; disallows `/o`, `/admin`, `/konto`, `/auth`, `/invite`, `/otsing`, `/teavitused`, `/api`; `Sitemap: https://kaidly.ee/sitemap.xml`. Preview/development: `Disallow: /` |
| `sitemap.xml` | only `https://kaidly.ee/` while the legal pages are drafts (`legalReady()` adds them later) |
| Noindex | `X-Robots-Tag: noindex, nofollow` on app/auth/admin/API routes; `<meta robots noindex>` on draft legal pages and the 404 page; everything noindex outside Production |
| Unknown URLs | real 404 (not a login redirect) |

## 1. Search Console (manual — needs Kenneth's Google account)

1. Open <https://search.google.com/search-console> → **Add property** → **Domain** →
   `kaidly.ee`.
2. Verify with the **DNS TXT record** Google shows (add it at the domain's DNS provider;
   do not change other records). Domain verification covers `https://kaidly.ee` and `www`.
3. **Sitemaps** → submit `https://kaidly.ee/sitemap.xml` (contains `https://kaidly.ee/`).
4. **URL inspection** → `https://kaidly.ee/` → **Request indexing**.
5. Optional: add a **URL-prefix** property `https://kaidly.ee/` too, for page-level reports.
6. Settings → International targeting is no longer configurable; the Estonian content,
   `.ee` domain and `lang="et"` are the signals.

## 2. What Google should understand from the page

| Element | Value |
|---|---|
| Title | `KAIDLY \| Elektripaigaldise digitaalne käidupäevik` |
| Description | "KAIDLY koondab elektripaigaldise käidupäeviku, käidukava, puudused, dokumentatsiooni ja tähtajad ühte kohta — käidukorraldajale ja elektriettevõttele." |
| H1 | "Elektripaigaldise käit. Lihtsalt." |
| Visible topics | käit, käidupäevik, käidukava, hooldus, kontrollid ja mõõtmised, puuduste haldus, dokumendid/dokumentatsioon, tähtajad ja meeldetuletused, käidukorraldaja |
| Structured data | `WebSite` + `SoftwareApplication` (name, url, description, `inLanguage: "et"`, `applicationCategory: BusinessApplication`); **no** organisation address, registry code or ratings (operator details are TBA) |

## 3. After indexing — what to watch (Search Console → Performance)

Queries containing:

- `kaidly`
- `elektripaigaldise käit`
- `elektripaigaldise käidupäevik` / `käidupäevik`
- `käidukava` / `elektripaigaldise käidukava`
- `käidukorraldus` / `käidukorraldaja`

Check impressions, clicks, average position and the displayed title/description. No ranking
claims are possible before real Search Console data exists.

## 4. Search landscape (public web, 2026-10-05)

Searches for *käidukorraldus*, *elektripaigaldise käit* and *käidukava* mostly return
**service companies** that offer käidukorraldus (e.g. Enefit, Firmus Elekter, Artec, Hepta
Energy, Elekserv, Viru Elektrivõrgud, Uno Elekter), the **law** (Elektriohutusseadus in
Riigi Teataja), guides/articles (Kortermajaleht) and student theses with example käidukavad.
No dedicated käidupäevik **software** appeared in these results — KAIDLY's angle is the
digital käidupäevik/käidukava *tool* used by käidukorraldajad and electrical companies, not
the käidukorraldus service itself. Terminology used across these sources: *käit*,
*käidukorraldus*, *käidukorraldaja*, *käidukava*, *käidupäevik*, *hooldus*, *kontroll*.
No search-volume figures are claimed.

## 5. Bing Webmaster Tools

Configured (Kenneth's account). Live URL inspection of `https://kaidly.ee/` reports
**indexable**. Site Scan reports `robots.txt` blocking `/auth/login` and `/auth/sign-up` —
**intentional** (application pages are never indexed); do not "fix" it. Re-submit the
sitemap only if its URL changes.

## 6. Later (not now)

Separate language URLs (`/en`, `/ru`) with `hreflang` would only matter for non-Estonian
search; they need routing changes and are not justified for the Estonian launch
(IMPLEMENTATION_PLAN.md, POST-v1).
