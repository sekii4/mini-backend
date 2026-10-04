import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { z } from 'zod';

const target = new URL('https://books.toscrape.com/');
const cataloguePageLimit = 3;
const scraperDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDirectory = path.join(scraperDirectory, 'cache');
const outputDirectory = path.join(scraperDirectory, 'output');
const booksOutputFile = path.join(outputDirectory, 'books.json');
const errorsOutputFile = path.join(outputDirectory, 'errors.json');
const userAgent = 'FlyRankInternship-A9/1.0 (+https://github.com/sekii4/mini-backend)';
const requestTimeoutMs = 10_000;
const minimumRequestIntervalMs = 500;
let lastNetworkRequestAt;
let detailFetches = 0;
let detailCacheHits = 0;
let pagesFetched = 0;
let cacheHits = 0;
const failedPages = [];
let validRecordCount = 0;
let invalidRecordCount = 0;
const runStartedAt = new Date();
const runStartedAtMs = Date.now();

const httpsUrlSchema = z.string().url().refine((value) => new URL(value).protocol === 'https:', {
  message: 'URL must use HTTPS',
});

const bookSchema = z.object({
  title: z.string().trim().min(1),
  product_url: httpsUrlSchema,
  price_text: z.string().trim().min(1),
  price_gbp: z.number().finite().nonnegative(),
  availability_text: z.string().trim().min(1),
  rating_text: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  source_page: httpsUrlSchema,
  fetched_at: z.string().refine((value) => Number.isFinite(Date.parse(value)), {
    message: 'Timestamp must be a valid date-time',
  }),
}).strict();

async function waitForRequestSlot() {
  if (lastNetworkRequestAt !== undefined) {
    const waitMs = minimumRequestIntervalMs - (Date.now() - lastNetworkRequestAt);
    if (waitMs > 0) await delay(waitMs);
  }
  lastNetworkRequestAt = Date.now();
}

class HttpStatusError extends Error {
  constructor(url, status) {
    super(`HTTP ${status}: ${url}`);
    this.status = status;
  }
}

function isRetryable(error) {
  return error.name === 'TimeoutError' || (error.status >= 500 && error.status <= 599);
}

async function fetchHtml(url) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await waitForRequestSlot();
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': userAgent },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });

      if (response.status !== 200) throw new HttpStatusError(url.href, response.status);

      pagesFetched += 1;
      return await response.text();
    } catch (error) {
      if (attempt === 0 && isRetryable(error)) {
        console.warn(`Retrying ${url.href} once after ${error.message}`);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Request attempts exhausted: ${url.href}`);
}

async function loadCataloguePage(url, pageNumber) {
  const cacheFile = path.join(cacheDirectory, `catalogue-page-${pageNumber}.html`);
  try {
    const html = await readFile(cacheFile, 'utf8');
    cacheHits += 1;
    console.log(`CACHE HIT catalogue-page-${pageNumber}.html response_size_bytes=${Buffer.byteLength(html, 'utf8')}`);
    return html;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let html;
  try {
    html = await fetchHtml(url);
  } catch (error) {
    failedPages.push(url.href);
    throw error;
  }
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cacheFile, html, 'utf8');
  console.log(`FETCH catalogue-page-${pageNumber}.html response_size_bytes=${Buffer.byteLength(html, 'utf8')}`);
  return html;
}

async function loadBookPage(productUrl) {
  const cacheKey = createHash('sha256').update(productUrl).digest('hex');
  const cacheFile = path.join(cacheDirectory, 'books', `${cacheKey}.html`);

  try {
    const [html, metadata] = await Promise.all([readFile(cacheFile, 'utf8'), stat(cacheFile)]);
    detailCacheHits += 1;
    cacheHits += 1;
    return { html, fetchedAt: metadata.mtime.toISOString() };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const html = await fetchHtml(new URL(productUrl));
  const fetchedAt = new Date().toISOString();
  await mkdir(path.dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, html, 'utf8');
  detailFetches += 1;
  return { html, fetchedAt };
}

function extractRawBook(html, productUrl, sourcePage, fetchedAt) {
  const $ = cheerio.load(html);
  const productArea = $('article.product_page');
  const ratingClasses = productArea.find('.product_main .star-rating').attr('class')?.split(/\s+/) ?? [];
  const description = productArea.find('#product_description').next('p').text().trim();

  return {
    title: productArea.find('.product_main h1').text().trim(),
    product_url: productUrl,
    price_text: productArea.find('.product_main .price_color').text().trim(),
    availability_text: productArea.find('.product_main .availability').text().replace(/\s+/g, ' ').trim(),
    rating_text: ratingClasses.find((className) => className !== 'star-rating') ?? '',
    description: description || null,
    source_page: sourcePage,
    fetched_at: fetchedAt,
  };
}

function normalizeBook(rawRecord) {
  const priceMatch = rawRecord.price_text.match(/^£\s*(\d+(?:\.\d{1,2})?)$/);
  return {
    ...rawRecord,
    price_gbp: priceMatch ? Number(priceMatch[1]) : Number.NaN,
  };
}

function validationReason(error) {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'record'}: ${issue.message}`)
    .join('; ');
}

async function saveValidatedRecords(rawRecords) {
  const validBooks = new Map();
  const invalidBooks = [];

  for (const rawRecord of rawRecords) {
    const normalized = normalizeBook(rawRecord);
    const result = bookSchema.safeParse(normalized);
    if (!result.success) {
      invalidBooks.push({
        product_url: rawRecord.product_url,
        reason: validationReason(result.error),
        record: normalized,
      });
      continue;
    }

    if (!validBooks.has(result.data.product_url)) {
      validBooks.set(result.data.product_url, result.data);
    }
  }

  await mkdir(outputDirectory, { recursive: true });
  const books = [...validBooks.values()];
  await writeFile(booksOutputFile, `${JSON.stringify(books, null, 2)}\n`, 'utf8');
  await writeFile(errorsOutputFile, `${JSON.stringify(invalidBooks, null, 2)}\n`, 'utf8');

  console.log(`valid_records=${books.length}`);
  console.log(`invalid_records=${invalidBooks.length}`);
  return { validRecords: books.length, invalidRecords: invalidBooks.length };
}

async function discoverBooks() {
  let catalogueUrl = target;
  const cataloguePages = [];
  const productUrls = new Map();
  let discovered = 0;

  for (let pageNumber = 1; pageNumber <= cataloguePageLimit; pageNumber += 1) {
    const html = await loadCataloguePage(catalogueUrl, pageNumber);
    const $ = cheerio.load(html);

    $('article.product_pod h3 a[href]').each((_index, element) => {
      const href = $(element).attr('href');
      const productUrl = new URL(href, catalogueUrl);
      if (productUrl.origin === target.origin) {
        discovered += 1;
        const sourcePage = pageNumber === 1
          ? new URL('catalogue/page-1.html', target).href
          : catalogueUrl.href;
        if (!productUrls.has(productUrl.href)) productUrls.set(productUrl.href, sourcePage);
      }
    });

    cataloguePages.push(catalogueUrl.href);

    if (pageNumber < cataloguePageLimit) {
      const nextHref = $('li.next a[href]').attr('href');
      if (!nextHref) throw new Error(`Catalogue page ${pageNumber} has no Next link`);
      catalogueUrl = new URL(nextHref, catalogueUrl);
    }
  }

  console.log(`catalogue_pages=${cataloguePages.length}`);
  console.log(`discovered=${discovered}`);
  console.log(`unique_urls=${productUrls.size}`);

  return productUrls;
}

try {
  const books = await discoverBooks();
  if (process.env.A9_FAILURE_TEST === '1') {
    const brokenUrl = new URL('catalogue/a9-stage5-deliberate-404.html', target).href;
    books.set(brokenUrl, new URL('catalogue/page-1.html', target).href);
  }

  const rawRecords = [];

  for (const [productUrl, sourcePage] of books) {
    try {
      const { html, fetchedAt } = await loadBookPage(productUrl);
      rawRecords.push(extractRawBook(html, productUrl, sourcePage, fetchedAt));
    } catch (error) {
      failedPages.push(productUrl);
      console.error(`Skipping failed book page ${productUrl}: ${error.message}`);
    }
  }

  if (rawRecords.length > 0) console.log(JSON.stringify(rawRecords[0], null, 2));
  console.log(`detail_pages=${rawRecords.length}`);
  console.log(`detail_fetches=${detailFetches}`);
  console.log(`detail_cache_hits=${detailCacheHits}`);
  const counts = await saveValidatedRecords(rawRecords);
  validRecordCount = counts.validRecords;
  invalidRecordCount = counts.invalidRecords;
} catch (error) {
  console.error(`Unable to process catalogue books: ${error.message}`);
  process.exitCode = 1;
} finally {
  const runReport = {
    started_at: runStartedAt.toISOString(),
    duration_ms: Date.now() - runStartedAtMs,
    pages_fetched: pagesFetched,
    cache_hits: cacheHits,
    valid_records: validRecordCount,
    invalid_records: invalidRecordCount,
    failed_pages: failedPages.length,
    failed_page_urls: failedPages,
  };

  try {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(path.join(outputDirectory, 'run-report.json'), `${JSON.stringify(runReport, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(runReport, null, 2));
  } catch (error) {
    console.error(`Unable to write run report: ${error.message}`);
    process.exitCode = 1;
  }
}