# A9 — The Polite Scraper

## Target classification

- **Target website:** Books to Scrape, `https://books.toscrape.com/`.
- **Classification:** The operator's `https://toscrape.com/` page describes this as a fictional bookstore that wants to be scraped and calls it a safe place for beginners learning web scraping and developers validating scraping technology. This makes it an expressly provided practice sandbox.
- **Scope:** Only the first three catalogue pages and the book detail pages linked from those pages. The catalogue has 20 books per page, for 60 expected unique books. The scraper will not follow pagination beyond page three or collect unrelated pages.
- **Planned data:** Book title, canonical product URL, displayed price and availability, rating, product description when present, source catalogue page, fetch timestamp, and a normalized numeric GBP price.

### Robots.txt check

Requested `https://books.toscrape.com/robots.txt` directly during Stage 0. It returned **HTTP 404 Not Found** with an nginx HTML not-found page; **no robots file found** at that location. A missing robots file is not a general permission to scrape other sites. This project is restricted to the expressly provided Books to Scrape practice sandbox and the three-page assignment scope.

### Why this target is appropriate

The target is intentionally fictional and explicitly presented by its operator as a sandbox for scraping practice. The collection is limited to a small, fixed portion of the site's catalogue, with caching and request pacing planned to avoid unnecessary repeat traffic. The collected fields are limited to those required for this exercise.

I will not reuse this code on another site without checking its rules and terms first.