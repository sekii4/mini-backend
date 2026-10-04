import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const target = new URL('https://books.toscrape.com/');
const cataloguePageLimit = 3;
const scraperDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDirectory = path.join(scraperDirectory, 'cache');
const userAgent = 'FlyRankInternship-A9/1.0 (+https://github.com/sekii4/mini-backend)';
const requestTimeoutMs = 10_000;
const minimumRequestIntervalMs = 500;
let lastNetworkRequestAt;

async function loadCataloguePage(url, pageNumber) {
  const cacheFile = path.join(cacheDirectory, `catalogue-page-${pageNumber}.html`);
  try {
    const html = await readFile(cacheFile, 'utf8');
    console.log(`CACHE HIT catalogue-page-${pageNumber}.html response_size_bytes=${Buffer.byteLength(html, 'utf8')}`);
    return html;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (lastNetworkRequestAt !== undefined) {
    const waitMs = minimumRequestIntervalMs - (Date.now() - lastNetworkRequestAt);
    if (waitMs > 0) await delay(waitMs);
  }

  lastNetworkRequestAt = Date.now();
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': userAgent },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  if (response.status !== 200) {
    throw new Error(`Catalogue fetch failed with HTTP ${response.status}`);
  }

  const html = await response.text();
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cacheFile, html, 'utf8');
  console.log(`FETCH catalogue-page-${pageNumber}.html response_size_bytes=${Buffer.byteLength(html, 'utf8')}`);
  return html;
}

async function discoverBooks() {
  let catalogueUrl = target;
  const cataloguePages = [];
  const productUrls = new Set();
  let discovered = 0;

  for (let pageNumber = 1; pageNumber <= cataloguePageLimit; pageNumber += 1) {
    const html = await loadCataloguePage(catalogueUrl, pageNumber);
    const $ = cheerio.load(html);

    $('article.product_pod h3 a[href]').each((_index, element) => {
      const href = $(element).attr('href');
      const productUrl = new URL(href, catalogueUrl);
      if (productUrl.origin === target.origin) {
        discovered += 1;
        productUrls.add(productUrl.href);
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
}

try {
  await discoverBooks();
} catch (error) {
  console.error(`Unable to discover catalogue books: ${error.message}`);
  process.exitCode = 1;
}