import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const target = new URL('https://books.toscrape.com/');
const scraperDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDirectory = path.join(scraperDirectory, 'cache');
const cacheFile = path.join(cacheDirectory, 'catalogue-page-1.html');
const userAgent = 'FlyRankInternship-A9/1.0 (+https://github.com/sekii4/mini-backend)';
const requestTimeoutMs = 10_000;

async function loadCataloguePage1() {
  try {
    const html = await readFile(cacheFile, 'utf8');
    console.log(`CACHE HIT catalogue-page-1.html response_size_bytes=${Buffer.byteLength(html, 'utf8')}`);
    return html;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const response = await fetch(target, {
    headers: { 'user-agent': userAgent },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  if (response.status !== 200) {
    throw new Error(`Catalogue fetch failed with HTTP ${response.status}`);
  }

  const html = await response.text();
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cacheFile, html, 'utf8');
  console.log(`FETCH catalogue-page-1.html response_size_bytes=${Buffer.byteLength(html, 'utf8')}`);
  return html;
}

try {
  await loadCataloguePage1();
} catch (error) {
  console.error(`Unable to load catalogue page 1: ${error.message}`);
  process.exitCode = 1;
}