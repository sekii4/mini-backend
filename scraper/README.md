# A9 — The Polite Scraper

A JavaScript/Node.js scraper for the Books to Scrape practice sandbox. It uses Node's built-in `fetch` and file system APIs, Cheerio for HTML parsing, and Zod for record validation. It discovers books from the first three catalogue pages, caches HTML, and writes clean JSON output.

## Run in under five minutes

Requires Node.js 20.18.1 or newer. From the repository root, install dependencies and run the scraper:

```bash
npm ci
npm run scrape
```

The run discovers the catalogue links, visits their book pages, and writes `scraper/output/books.json`, `scraper/output/errors.json`, and `scraper/output/run-report.json`. Cached HTML is stored locally in `scraper/cache/` and ignored by Git. With an ordinary internet connection, the request spacing keeps a cold run under five minutes; later runs use the cache.

To exercise the Stage 5 failure handling in PowerShell:

```powershell
$env:A9_FAILURE_TEST = '1'
npm run scrape
Remove-Item Env:A9_FAILURE_TEST
```

This adds one known-missing URL on Books to Scrape. The scraper should finish, preserve the 60 valid books, and report `failed_pages: 1`.

## Target classification

- **Target:** `https://books.toscrape.com/` only.
- **Why appropriate:** The operator's `https://toscrape.com/` page describes Books to Scrape as a fictional bookstore that wants to be scraped and a safe place to learn and validate scraping tools. It is an expressly provided practice sandbox.
- **Scope:** The first three catalogue pages only, plus book detail pages linked from those pages. There are 20 books per page, for 60 expected unique products. Pagination is not followed beyond page three.
- **Robots check:** `https://books.toscrape.com/robots.txt` returned HTTP 404 with an nginx not-found page; **no robots file found** at that location. This result is recorded, not treated as general permission to scrape other websites.
- **Collected data:** title, canonical product URL, displayed price, numeric GBP price, availability, rating, description when present, source catalogue URL, and fetch timestamp.

I will not reuse this code on another site without checking its rules and terms first.

## Record schema

Each entry in `books.json` is validated with Zod and has these fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | string | Book title |
| `product_url` | HTTPS URL string | Canonical product-page identity; duplicates are removed |
| `price_text` | string | Original displayed price, such as `£51.77` |
| `price_gbp` | number | Normalized GBP price, such as `51.77` |
| `availability_text` | string | Availability text from the product area |
| `rating_text` | string | Star rating label |
| `description` | string or null | Product description; null when not present |
| `source_page` | HTTPS URL string | Catalogue page where the product link was found |
| `fetched_at` | date-time string | Time the detail HTML was fetched or cached |

Every record is validated before it is written. Invalid records are excluded from `books.json` and written to `errors.json` with validation reasons. Output files are rewritten per run and products are keyed by absolute URL, so rerunning does not append duplicate books.

## Polite request behavior

- **User-Agent:** `FlyRankInternship-A9/1.0 (+https://github.com/sekii4/mini-backend)` identifies the scraper and links to its repository.
- Enforces at least 500 ms between real request starts; cache hits do not wait.
- Each request has a 10-second timeout and is parsed only after HTTP 200.
- Catalogue and detail HTML are cached locally. The cache is not committed.
- A timeout or 5xx response is retried once. 403 and 404 responses are not retried; a 403 is treated as the site's refusal.
- Detail pages are handled independently: one failed page is logged and skipped while remaining pages continue.

**Limitation:** The scraper depends on the sandbox's current HTML structure. If its markup changes, selectors may stop matching; the run will report invalid records or failed pages rather than claiming those records were collected successfully.

## Run report example

This is the actual committed report from a successful cached run. `pages_fetched` counts successful network fetches; `cache_hits` counts catalogue and detail pages read from the local cache.

```json
{
  "started_at": "2026-10-04T14:58:14.741Z",
  "duration_ms": 300,
  "pages_fetched": 0,
  "cache_hits": 63,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0,
  "failed_page_urls": []
}
```

## Browser and ethics

A browser is unnecessary: the catalogue and product details are present in static HTML, and the Books to Scrape sandbox does not require JavaScript rendering. Built-in `fetch` plus Cheerio is sufficient.

Use an official API when one exists. Scrape only the data needed for the stated purpose. Never bypass logins, paywalls, blocks, or other access controls. Respect each site's rules and terms before collecting data.
